import "server-only";

import { and, asc, desc, eq, inArray, isNull, lt, lte, or } from "drizzle-orm";

import { db } from "@/db";
import {
  favorites,
  pageCommentReactions,
  pageComments,
  pageVersions,
  pages,
  references,
  subscriptions,
  users,
} from "@/db/schema";
import { issueDto } from "@/lib/api/dto";
import { ApiInputError } from "@/lib/api/errors";
import { apiInvalidate } from "@/lib/api/invalidate";
import { visibleRows } from "@/lib/api/scope";
import type { ApiAuth } from "@/lib/api/auth";
import { dispatchWebhook } from "@/lib/api/webhooks";
import { isReactionEmoji, summarizeReactions } from "@/lib/comment-reactions";
import { getMembers, getPage } from "@/lib/data";
import { docToMarkdown, docToText, markdownToDoc } from "@/lib/markdown";
import { findMentionedMemberIds } from "@/lib/mentions";
import { audienceFor, notify, subscribe, subscribeMany } from "@/lib/notify";
import { shouldSnapshot, VERSION_RETENTION } from "@/lib/page-collab";
import { carryBlockIds, CONFLICT_TOLERANCE_MS, isEditConflict, isMarkdownLossless } from "@/lib/page-markdown";
import { extractReferences } from "@/lib/references";

/**
 * Page reads and writes for the mobile app, mirroring the web's server actions
 * in actions.ts (updatePage, restorePageVersion, createPageComment,
 * deletePageComment, togglePageCommentReaction) for a caller identified by an
 * API key rather than a session cookie. Visibility is the route's job: every
 * route calls assertPageVisible before reaching these.
 */

const BASE = process.env.NEXT_PUBLIC_APP_URL || "";

export const NOT_MARKDOWN_EDITABLE =
  "This page has formatting Markdown can't hold (colours, callouts, toggles, columns, mentions, embeds or similar). Saving Markdown over it would remove that formatting, so edit it on the web.";

export async function apiPageDetail(auth: ApiAuth, id: string) {
  const page = await getPage(auth.workspaceId, id);
  if (!page) return null;
  const [creator, children, fav, sub] = await Promise.all([
    page.creatorId
      ? db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, page.creatorId)).limit(1)
      : Promise.resolve([]),
    db
      .select({ id: pages.id, title: pages.title, icon: pages.icon, updatedAt: pages.updatedAt })
      .from(pages)
      .where(and(eq(pages.workspaceId, auth.workspaceId), eq(pages.parentId, id), isNull(pages.deletedAt)))
      .orderBy(asc(pages.position), asc(pages.createdAt)),
    auth.userId ? hasRow(favorites, auth.userId, id) : Promise.resolve(false),
    auth.userId ? hasRow(subscriptions, auth.userId, id) : Promise.resolve(false),
  ]);
  const linked = visibleRows(auth, page.linkedIssues, (i) => i.projectId).map((i) => {
    const dto = issueDto(i);
    return { id: dto.id, identifier: dto.identifier, title: dto.title, status: dto.status, priority: dto.priority, assignee: dto.assignee, project: dto.project };
  });
  return {
    id: page.id,
    title: page.title,
    icon: page.icon,
    parentId: page.parentId,
    projectId: page.projectId,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
    deletedAt: page.deletedAt,
    creator: creator[0] ?? null,
    content: page.content,
    markdown: docToMarkdown(page.content),
    markdownEditable: isMarkdownLossless(page.content),
    linkedIssues: linked,
    subPages: children,
    favorite: fav,
    watching: sub,
    url: BASE ? `${BASE}/pages/${page.id}` : `/pages/${page.id}`,
  };
}

async function hasRow(table: typeof favorites | typeof subscriptions, userId: string, pageId: string): Promise<boolean> {
  const t = table as typeof favorites;
  const [row] = await db
    .select({ id: t.id })
    .from(t)
    .where(and(eq(t.userId, userId), eq(t.kind, "page"), eq(t.targetId, pageId)))
    .limit(1);
  return Boolean(row);
}

export type SavePageInput = {
  title?: unknown;
  icon?: unknown;
  /** Markdown for the whole body (`markdown` is accepted as an alias). */
  content?: unknown;
  markdown?: unknown;
  /** The `updatedAt` of the copy the client edited. When given, a newer save is a conflict. */
  knownUpdatedAt?: unknown;
  /** Replace a body Markdown can't represent anyway. For integrations that mean it. */
  allowLossy?: unknown;
};

export type SavePageResult = { ok: true } | { ok: false; reason: "not_found" } | { ok: false; reason: "conflict"; updatedAt: Date };

/**
 * Save a page, refusing to overwrite work the caller hasn't seen and refusing
 * a Markdown body that would strip formatting. Mirrors the web's updatePage,
 * except that a conflict is refused rather than applied and flagged: a phone
 * edit has no live editor to show the other person's changes in.
 */
export async function apiSavePage(auth: ApiAuth, id: string, input: SavePageInput): Promise<SavePageResult> {
  const ws = auth.workspaceId;
  const now = new Date();
  const values: Record<string, unknown> = { updatedAt: now };
  if (typeof input.title === "string") values.title = input.title.trim().slice(0, 500) || "Untitled";
  if (typeof input.icon === "string" && input.icon.trim()) values.icon = input.icon.trim().slice(0, 16);
  const body = typeof input.content === "string" ? input.content : typeof input.markdown === "string" ? input.markdown : undefined;

  let known: Date | null = null;
  if (input.knownUpdatedAt != null && input.knownUpdatedAt !== "") {
    known = new Date(String(input.knownUpdatedAt));
    if (Number.isNaN(known.getTime())) throw new ApiInputError("`knownUpdatedAt` must be an ISO timestamp.");
  }

  const [current] = await db
    .select({ title: pages.title, content: pages.content, updatedAt: pages.updatedAt })
    .from(pages)
    .where(and(eq(pages.workspaceId, ws), eq(pages.id, id), isNull(pages.deletedAt)))
    .limit(1);
  if (!current) return { ok: false, reason: "not_found" };
  if (known && isEditConflict(current.updatedAt, known)) return { ok: false, reason: "conflict", updatedAt: current.updatedAt };

  let doc: unknown = undefined;
  if (body !== undefined) {
    if (input.allowLossy !== true && !isMarkdownLossless(current.content)) throw new ApiInputError(NOT_MARKDOWN_EDITABLE, 422);
    doc = carryBlockIds(current.content, markdownToDoc(body));
    values.content = doc;
    values.contentText = docToText(doc).slice(0, 20000);

    const [last] = await db
      .select({ createdAt: pageVersions.createdAt })
      .from(pageVersions)
      .where(eq(pageVersions.pageId, id))
      .orderBy(desc(pageVersions.createdAt))
      .limit(1);
    if (shouldSnapshot(last?.createdAt ?? null, now)) {
      await db.insert(pageVersions).values({ workspaceId: ws, pageId: id, title: current.title, content: current.content, authorId: auth.userId, cause: "auto" });
      await prunePageVersions(id);
    }
  }

  const conds = [eq(pages.workspaceId, ws), eq(pages.id, id), isNull(pages.deletedAt)];
  // Re-check in the write itself, so a save landing between the read and this
  // update is still caught rather than overwritten.
  if (known) conds.push(lte(pages.updatedAt, new Date(known.getTime() + CONFLICT_TOLERANCE_MS)));
  const res = await db.update(pages).set(values).where(and(...conds)).returning({ id: pages.id, title: pages.title });
  if (res.length === 0) {
    const [again] = await db.select({ updatedAt: pages.updatedAt }).from(pages).where(and(eq(pages.workspaceId, ws), eq(pages.id, id), isNull(pages.deletedAt))).limit(1);
    return again ? { ok: false, reason: "conflict", updatedAt: again.updatedAt } : { ok: false, reason: "not_found" };
  }
  if (doc !== undefined) await syncPageReferences(ws, id, doc);
  apiInvalidate(ws, "pages", "issues");
  await dispatchWebhook(ws, "page.updated", { id, title: res[0].title });
  return { ok: true };
}

/** Rewrite the page's outgoing reference graph from its body, as the web does on save. */
async function syncPageReferences(workspaceId: string, pageId: string, doc: unknown): Promise<void> {
  const refs = extractReferences(doc).filter((r) => r.targetId !== pageId);
  await db.delete(references).where(and(eq(references.sourceType, "page"), eq(references.sourceId, pageId)));
  if (refs.length)
    await db
      .insert(references)
      .values(refs.map((r) => ({ workspaceId, sourceType: "page", sourceId: pageId, targetType: r.targetType, targetId: r.targetId })))
      .onConflictDoNothing();
}

/** Keep only the newest VERSION_RETENTION versions, as the web does. */
async function prunePageVersions(pageId: string): Promise<void> {
  const keep = await db
    .select({ createdAt: pageVersions.createdAt })
    .from(pageVersions)
    .where(eq(pageVersions.pageId, pageId))
    .orderBy(desc(pageVersions.createdAt))
    .limit(VERSION_RETENTION);
  if (keep.length < VERSION_RETENTION) return;
  await db.delete(pageVersions).where(and(eq(pageVersions.pageId, pageId), lt(pageVersions.createdAt, keep[keep.length - 1].createdAt)));
}

// ---- Version history ----

export async function apiPageVersions(workspaceId: string, pageId: string) {
  const rows = await db
    .select({ id: pageVersions.id, title: pageVersions.title, cause: pageVersions.cause, createdAt: pageVersions.createdAt, authorId: users.id, authorName: users.name })
    .from(pageVersions)
    .leftJoin(users, eq(pageVersions.authorId, users.id))
    .where(and(eq(pageVersions.workspaceId, workspaceId), eq(pageVersions.pageId, pageId)))
    .orderBy(desc(pageVersions.createdAt));
  return rows.map((r) => ({ id: r.id, title: r.title, cause: r.cause, createdAt: r.createdAt, author: r.authorId ? { id: r.authorId, name: r.authorName } : null }));
}

/** One version as Markdown, for a read-only preview. `complete` is false when Markdown drops some of its formatting. */
export async function apiPageVersion(workspaceId: string, pageId: string, versionId: string) {
  const [row] = await db
    .select({ id: pageVersions.id, title: pageVersions.title, content: pageVersions.content, cause: pageVersions.cause, createdAt: pageVersions.createdAt, authorId: users.id, authorName: users.name })
    .from(pageVersions)
    .leftJoin(users, eq(pageVersions.authorId, users.id))
    .where(and(eq(pageVersions.workspaceId, workspaceId), eq(pageVersions.pageId, pageId), eq(pageVersions.id, versionId)))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    cause: row.cause,
    createdAt: row.createdAt,
    author: row.authorId ? { id: row.authorId, name: row.authorName } : null,
    markdown: docToMarkdown(row.content),
    complete: isMarkdownLossless(row.content),
  };
}

/** Roll back to a version, snapshotting the current state first (cause "restore") so it can be undone. */
export async function apiRestoreVersion(auth: ApiAuth, pageId: string, versionId: string): Promise<boolean> {
  const ws = auth.workspaceId;
  const [version] = await db
    .select({ title: pageVersions.title, content: pageVersions.content })
    .from(pageVersions)
    .where(and(eq(pageVersions.workspaceId, ws), eq(pageVersions.pageId, pageId), eq(pageVersions.id, versionId)))
    .limit(1);
  if (!version) return false;
  const [current] = await db
    .select({ title: pages.title, content: pages.content })
    .from(pages)
    .where(and(eq(pages.workspaceId, ws), eq(pages.id, pageId), isNull(pages.deletedAt)))
    .limit(1);
  if (!current) return false;

  await db.insert(pageVersions).values({ workspaceId: ws, pageId, title: current.title, content: current.content, authorId: auth.userId, cause: "restore" });
  await prunePageVersions(pageId);
  await db
    .update(pages)
    .set({ title: version.title, content: version.content, contentText: docToText(version.content).slice(0, 20000), updatedAt: new Date() })
    .where(and(eq(pages.workspaceId, ws), eq(pages.id, pageId)));
  await syncPageReferences(ws, pageId, version.content);
  apiInvalidate(ws, "pages", "issues");
  await dispatchWebhook(ws, "page.updated", { id: pageId, title: version.title });
  return true;
}

// ---- Comments ----

/** Every comment on the page, oldest first, with reactions. Replies carry their thread's `parentId`. */
export async function apiPageCommentList(auth: ApiAuth, pageId: string) {
  const rows = await db
    .select({
      id: pageComments.id,
      body: pageComments.body,
      parentId: pageComments.parentId,
      blockId: pageComments.blockId,
      resolvedAt: pageComments.resolvedAt,
      createdAt: pageComments.createdAt,
      authorId: users.id,
      authorName: users.name,
    })
    .from(pageComments)
    .leftJoin(users, eq(pageComments.authorId, users.id))
    .where(and(eq(pageComments.workspaceId, auth.workspaceId), eq(pageComments.pageId, pageId)))
    .orderBy(asc(pageComments.createdAt));
  const reactionRows = rows.length
    ? await db
        .select({ commentId: pageCommentReactions.pageCommentId, userId: pageCommentReactions.userId, emoji: pageCommentReactions.emoji })
        .from(pageCommentReactions)
        .where(inArray(pageCommentReactions.pageCommentId, rows.map((r) => r.id)))
        .orderBy(asc(pageCommentReactions.createdAt))
    : [];
  const reactions = summarizeReactions(reactionRows, auth.userId);
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    parentId: r.parentId,
    blockId: r.blockId,
    resolved: r.resolvedAt != null,
    resolvedAt: r.resolvedAt,
    author: r.authorId ? { id: r.authorId, name: r.authorName } : null,
    createdAt: r.createdAt,
    reactions: reactions.get(r.id) ?? [],
  }));
}

/**
 * Comment on a page or reply to a thread, then subscribe and notify exactly
 * as the web's createPageComment does. Replies go one level deep, so a reply
 * to a reply joins its thread.
 */
export async function apiAddPageComment(auth: ApiAuth, pageId: string, input: { body?: unknown; parentId?: unknown; blockId?: unknown }): Promise<string> {
  const ws = auth.workspaceId;
  const text = typeof input.body === "string" ? input.body.trim() : "";
  if (!text) throw new ApiInputError("`body` is required.");
  const [page] = await db
    .select({ title: pages.title })
    .from(pages)
    .where(and(eq(pages.workspaceId, ws), eq(pages.id, pageId)))
    .limit(1);
  if (!page) throw new ApiInputError("Page not found.", 404);

  let parentId: string | null = null;
  let blockId = typeof input.blockId === "string" && input.blockId ? input.blockId : null;
  if (typeof input.parentId === "string" && input.parentId) {
    const [parent] = await db
      .select({ id: pageComments.id, parentId: pageComments.parentId, blockId: pageComments.blockId })
      .from(pageComments)
      .where(and(eq(pageComments.workspaceId, ws), eq(pageComments.pageId, pageId), eq(pageComments.id, input.parentId)))
      .limit(1);
    if (!parent) throw new ApiInputError("The comment you're replying to no longer exists.", 404);
    parentId = parent.parentId ?? parent.id;
    blockId = parent.blockId;
  }

  const [created] = await db
    .insert(pageComments)
    .values({ workspaceId: ws, pageId, parentId, blockId, authorId: auth.userId, body: text.slice(0, 10000) })
    .returning({ id: pageComments.id });

  if (auth.userId) {
    const me = auth.userId;
    const members = await getMembers(ws);
    const name = members.find((m) => m.id === me)?.name ?? "Someone";
    const target = { kind: "page" as const, id: pageId };
    const mentioned = findMentionedMemberIds(text, members).filter((uid) => uid !== me);
    await subscribe(ws, me, "page", pageId);
    await subscribeMany(ws, mentioned, "page", pageId);
    await notify({ workspaceId: ws, actorId: me, type: "mentioned", target, userIds: mentioned, title: `${name} mentioned you on ${page.title}`, body: text.slice(0, 140) });
    const others = (await audienceFor(ws, target, me)).filter((uid) => !mentioned.includes(uid));
    await notify({ workspaceId: ws, actorId: me, type: "commented", target, userIds: others, title: `${name} commented on ${page.title}`, body: text.slice(0, 140) });
  }
  apiInvalidate(ws, "pages");
  return created.id;
}

async function commentRow(workspaceId: string, id: string) {
  const [row] = await db
    .select({ id: pageComments.id, authorId: pageComments.authorId })
    .from(pageComments)
    .where(and(eq(pageComments.workspaceId, workspaceId), eq(pageComments.id, id)))
    .limit(1);
  return row ?? null;
}

/**
 * The web lets people delete and edit only their own comments. A key that acts
 * as a member (the app) follows that; a Settings-made integration key, which
 * acts as no one, keeps the moderation it always had.
 */
function assertAuthor(auth: ApiAuth, authorId: string | null): void {
  if (auth.userId && authorId !== auth.userId) throw new ApiInputError("You can only change your own comments.", 403);
}

/** Delete a comment and, when it starts a thread, its replies. */
export async function apiDeletePageComment(auth: ApiAuth, id: string): Promise<boolean> {
  const row = await commentRow(auth.workspaceId, id);
  if (!row) return false;
  assertAuthor(auth, row.authorId);
  await db
    .delete(pageComments)
    .where(and(eq(pageComments.workspaceId, auth.workspaceId), or(eq(pageComments.id, id), eq(pageComments.parentId, id))));
  apiInvalidate(auth.workspaceId, "pages");
  return true;
}

export async function apiEditPageComment(auth: ApiAuth, id: string, body: string): Promise<boolean> {
  const row = await commentRow(auth.workspaceId, id);
  if (!row) return false;
  assertAuthor(auth, row.authorId);
  const text = body.trim();
  if (!text) throw new ApiInputError("`body` is required.");
  await db.update(pageComments).set({ body: text.slice(0, 10000) }).where(eq(pageComments.id, id));
  apiInvalidate(auth.workspaceId, "pages");
  return true;
}

/** Add the caller's reaction, or take it back if they already reacted with that emoji. */
export async function apiTogglePageCommentReaction(auth: ApiAuth, commentId: string, emoji: unknown): Promise<{ on: boolean } | null> {
  if (!auth.userId) throw new ApiInputError("Reactions belong to a member; this key acts as no one.", 403);
  if (!isReactionEmoji(emoji)) throw new ApiInputError("Unsupported reaction.");
  if (!(await commentRow(auth.workspaceId, commentId))) return null;
  const mine = and(eq(pageCommentReactions.pageCommentId, commentId), eq(pageCommentReactions.userId, auth.userId), eq(pageCommentReactions.emoji, emoji));
  const removed = await db.delete(pageCommentReactions).where(mine).returning({ id: pageCommentReactions.id });
  if (removed.length === 0) await db.insert(pageCommentReactions).values({ pageCommentId: commentId, userId: auth.userId, emoji }).onConflictDoNothing();
  apiInvalidate(auth.workspaceId, "pages");
  return { on: removed.length === 0 };
}
