import "server-only";

import { put } from "@vercel/blob";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  activity,
  attachments,
  commentReactions,
  comments,
  favorites,
  issues,
  pages,
  projects,
  subscriptions,
  users,
} from "@/db/schema";
import { ApiInputError } from "@/lib/api/errors";
import { apiInvalidateAttachments } from "@/lib/api/invalidate";
import { assertIssueVisible, assertPageVisible, assertProjectVisible } from "@/lib/api/scope";
import { canSeeProject } from "@/lib/api/scope-rules";
import { describeActivity, REACTION_EMOJI, summarizeReactions } from "@/lib/api/timeline-text";
import type { ApiAuth } from "@/lib/api/auth";
import { isBlobConfigured, MAX_ATTACHMENT_BYTES } from "@/lib/blob";
import { docToMarkdown } from "@/lib/markdown";
import { subscribe, SUBSCRIBABLE } from "@/lib/notify";

/**
 * The per-member parts of an issue a phone needs and the shared issue reads
 * leave out: its description as Markdown, who created it, whether the caller
 * favourited or follows it, the timeline, reactions, and binary uploads.
 *
 * Everything here is keyed on the API caller (auth.userId), never on a
 * session, and every read of a target first checks the caller may see it.
 */

type Kind = "issue" | "page" | "project";

const isKind = (v: unknown): v is Kind => typeof v === "string" && SUBSCRIBABLE.has(v);

async function memberNames(workspaceId: string, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const rows = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, unique));
  return new Map(rows.map((r) => [r.id, r.name]));
}

/** Whether the caller has favourited / follows one thing. */
async function memberState(userId: string | null, kind: Kind, targetId: string) {
  if (!userId) return { favorite: false, watching: false };
  const [fav, sub] = await Promise.all([
    db
      .select({ id: favorites.id })
      .from(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.kind, kind), eq(favorites.targetId, targetId)))
      .limit(1),
    db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.kind, kind), eq(subscriptions.targetId, targetId)))
      .limit(1),
  ]);
  return { favorite: fav.length > 0, watching: sub.length > 0 };
}

/** Issue detail fields beyond issueDetailDto. Call after assertIssueVisible. */
export async function apiIssueExtras(auth: ApiAuth, issueId: string) {
  const [row] = await db
    .select({ description: issues.description, creatorId: issues.creatorId, creatorName: users.name })
    .from(issues)
    .leftJoin(users, eq(issues.creatorId, users.id))
    .where(and(eq(issues.workspaceId, auth.workspaceId), eq(issues.id, issueId)))
    .limit(1);
  if (!row) return null;
  const state = await memberState(auth.userId, "issue", issueId);
  const description = row.description ? docToMarkdown(row.description).trim() : "";
  return {
    description: description || null,
    creator: row.creatorId ? { id: row.creatorId, name: row.creatorName ?? "Someone" } : null,
    ...state,
  };
}

/** Comments with reaction summaries, oldest first. */
export async function apiIssueCommentsWithReactions(auth: ApiAuth, issueId: string) {
  const rows = await db
    .select({ id: comments.id, body: comments.body, createdAt: comments.createdAt, authorId: users.id, authorName: users.name })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id))
    .where(and(eq(comments.workspaceId, auth.workspaceId), eq(comments.issueId, issueId)))
    .orderBy(asc(comments.createdAt));
  const reactions = rows.length
    ? await db
        .select({ commentId: commentReactions.commentId, emoji: commentReactions.emoji, userId: commentReactions.userId })
        .from(commentReactions)
        .where(inArray(commentReactions.commentId, rows.map((r) => r.id)))
        .orderBy(asc(commentReactions.createdAt))
    : [];
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    author: r.authorId ? { id: r.authorId, name: r.authorName ?? "Someone" } : null,
    createdAt: r.createdAt,
    reactions: summarizeReactions(
      reactions.filter((x) => x.commentId === r.id),
      auth.userId,
    ),
  }));
}

/** Comments and activity merged into one oldest-first stream. */
export async function apiIssueTimeline(auth: ApiAuth, issueId: string) {
  const [cs, acts] = await Promise.all([
    apiIssueCommentsWithReactions(auth, issueId),
    db
      .select({ id: activity.id, type: activity.type, data: activity.data, createdAt: activity.createdAt, actorId: activity.actorId })
      .from(activity)
      .where(and(eq(activity.workspaceId, auth.workspaceId), eq(activity.issueId, issueId))),
  ]);
  const names = await memberNames(
    auth.workspaceId,
    acts.flatMap((a) => {
      const d = a.data as { from?: string | null; to?: string | null } | null;
      return [a.actorId ?? "", a.type === "assignee" ? (d?.to ?? "") : ""];
    }),
  );
  const events = [
    ...cs.map((c) => ({
      id: c.id,
      kind: "comment" as const,
      body: c.body,
      actor: c.author,
      createdAt: c.createdAt,
      reactions: c.reactions,
    })),
    ...acts.map((a) => {
      const data = a.data as { from?: string | null; to?: string | null } | null;
      return {
        id: a.id,
        kind: "activity" as const,
        action: describeActivity(a.type, data, (id) => names.get(id)),
        actor: a.actorId ? { id: a.actorId, name: names.get(a.actorId) ?? "Someone" } : null,
        createdAt: a.createdAt,
        meta: { type: a.type, ...(data ?? {}) },
      };
    }),
  ];
  events.sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime());
  return events;
}

/** Add or remove the caller's reaction; returns whether it is now on. */
export async function apiToggleCommentReaction(auth: ApiAuth, commentId: string, emoji: unknown): Promise<boolean> {
  if (!auth.userId) throw new ApiInputError("Reacting needs a key that acts as a member.");
  if (typeof emoji !== "string" || !(REACTION_EMOJI as readonly string[]).includes(emoji))
    throw new ApiInputError(`\`emoji\` must be one of ${REACTION_EMOJI.join(" ")}.`);
  const [c] = await db
    .select({ id: comments.id })
    .from(comments)
    .where(and(eq(comments.workspaceId, auth.workspaceId), eq(comments.id, commentId)))
    .limit(1);
  if (!c) throw new ApiInputError("Comment not found.", 404);
  const mine = and(eq(commentReactions.commentId, commentId), eq(commentReactions.userId, auth.userId), eq(commentReactions.emoji, emoji));
  const [existing] = await db.select({ id: commentReactions.id }).from(commentReactions).where(mine).limit(1);
  if (existing) {
    await db.delete(commentReactions).where(eq(commentReactions.id, existing.id));
    return false;
  }
  await db.insert(commentReactions).values({ commentId, userId: auth.userId, emoji }).onConflictDoNothing();
  return true;
}

/** 404 unless the target exists in this workspace and the caller may see it. */
async function assertTarget(auth: ApiAuth, kind: Kind, id: string): Promise<void> {
  const missing = new ApiInputError(`${kind[0].toUpperCase()}${kind.slice(1)} not found.`, 404);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw missing;
  if (kind === "issue") {
    const [row] = await db.select({ id: issues.id }).from(issues).where(and(eq(issues.workspaceId, auth.workspaceId), eq(issues.id, id))).limit(1);
    if (!row) throw missing;
    return assertIssueVisible(auth, id);
  }
  if (kind === "page") {
    const [row] = await db
      .select({ id: pages.id })
      .from(pages)
      .where(and(eq(pages.workspaceId, auth.workspaceId), eq(pages.id, id), isNull(pages.deletedAt)))
      .limit(1);
    if (!row) throw missing;
    return assertPageVisible(auth, id);
  }
  const [row] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.workspaceId, auth.workspaceId), eq(projects.id, id))).limit(1);
  if (!row) throw missing;
  assertProjectVisible(auth, id, "Project");
}

function parseToggle(body: unknown): { kind: Kind; id: string; on: boolean } {
  const b = (body ?? {}) as { type?: unknown; id?: unknown; on?: unknown };
  if (!isKind(b.type)) throw new ApiInputError("`type` must be issue, page or project.");
  if (typeof b.id !== "string" || !b.id) throw new ApiInputError("`id` is required.");
  if (typeof b.on !== "boolean") throw new ApiInputError("`on` must be true or false.");
  return { kind: b.type, id: b.id, on: b.on };
}

/** Favourite or un-favourite; idempotent either way. */
export async function apiSetFavorite(auth: ApiAuth, body: unknown): Promise<boolean> {
  if (!auth.userId) throw new ApiInputError("Favourites need a key that acts as a member.");
  const { kind, id, on } = parseToggle(body);
  await assertTarget(auth, kind, id);
  if (on) {
    await db.insert(favorites).values({ workspaceId: auth.workspaceId, userId: auth.userId, kind, targetId: id }).onConflictDoNothing();
  } else {
    await db.delete(favorites).where(and(eq(favorites.userId, auth.userId), eq(favorites.kind, kind), eq(favorites.targetId, id)));
  }
  return on;
}

/** Follow or unfollow; idempotent either way. */
export async function apiSetSubscription(auth: ApiAuth, body: unknown): Promise<boolean> {
  if (!auth.userId) throw new ApiInputError("Following needs a key that acts as a member.");
  const { kind, id, on } = parseToggle(body);
  await assertTarget(auth, kind, id);
  if (on) await subscribe(auth.workspaceId, auth.userId, kind, id);
  else
    await db
      .delete(subscriptions)
      .where(and(eq(subscriptions.userId, auth.userId), eq(subscriptions.kind, kind), eq(subscriptions.targetId, id)));
  return on;
}

export async function apiFollowState(auth: ApiAuth, kind: Kind, id: string) {
  return memberState(auth.userId, kind, id);
}

/** The caller's favourites with a display title, hiding what they can't see. */
export async function apiListFavorites(auth: ApiAuth) {
  if (!auth.userId) return [];
  const favs = await db
    .select()
    .from(favorites)
    .where(and(eq(favorites.workspaceId, auth.workspaceId), eq(favorites.userId, auth.userId)))
    .orderBy(asc(favorites.createdAt));
  const ids = (k: Kind) => favs.filter((f) => f.kind === k).map((f) => f.targetId);
  const [issueRows, pageRows, projectRows] = await Promise.all([
    ids("issue").length
      ? db
          .select({ id: issues.id, title: issues.title, number: issues.number, status: issues.status, projectId: issues.projectId, key: projects.key })
          .from(issues)
          .leftJoin(projects, eq(issues.projectId, projects.id))
          .where(and(eq(issues.workspaceId, auth.workspaceId), inArray(issues.id, ids("issue"))))
      : [],
    ids("page").length
      ? db
          .select({ id: pages.id, title: pages.title, icon: pages.icon, projectId: pages.projectId })
          .from(pages)
          .where(and(eq(pages.workspaceId, auth.workspaceId), inArray(pages.id, ids("page")), isNull(pages.deletedAt)))
      : [],
    ids("project").length
      ? db
          .select({ id: projects.id, name: projects.name, color: projects.color })
          .from(projects)
          .where(and(eq(projects.workspaceId, auth.workspaceId), inArray(projects.id, ids("project"))))
      : [],
  ]);
  const seen = (projectId: string | null) => canSeeProject(auth.scope, projectId);
  type Favorite =
    | { type: "issue"; id: string; title: string; identifier: string; status: string }
    | { type: "page"; id: string; title: string; icon: string }
    | { type: "project"; id: string; title: string; color: string };
  return favs.flatMap((f): Favorite[] => {
    if (f.kind === "issue") {
      const r = issueRows.find((x) => x.id === f.targetId);
      return r && seen(r.projectId)
        ? [{ type: "issue" as const, id: r.id, title: r.title, identifier: r.key ? `${r.key}-${r.number}` : `#${r.number}`, status: r.status }]
        : [];
    }
    if (f.kind === "page") {
      const r = pageRows.find((x) => x.id === f.targetId);
      return r && seen(r.projectId) ? [{ type: "page" as const, id: r.id, title: r.title || "Untitled", icon: r.icon }] : [];
    }
    const r = projectRows.find((x) => x.id === f.targetId);
    return r && seen(r.id) ? [{ type: "project" as const, id: r.id, title: r.name, color: r.color }] : [];
  });
}

/** Store a file from a multipart body and attach it to the issue. */
export async function apiUploadAttachment(auth: ApiAuth, issueId: string, form: FormData) {
  if (!isBlobConfigured()) throw new ApiInputError("File storage isn't configured on this workspace.", 503);
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw new ApiInputError("Send the file as multipart field `file`.");
  if (file.size > MAX_ATTACHMENT_BYTES) throw new ApiInputError("File is too large (max 10 MB).", 413);
  const name = (file.name || "file").slice(0, 300);
  const blob = await put(`${auth.workspaceId}/${issueId}/${name}`, file, { access: "public", addRandomSuffix: true });
  const [created] = await db
    .insert(attachments)
    .values({
      workspaceId: auth.workspaceId,
      issueId,
      uploaderId: auth.userId,
      name,
      url: blob.url,
      contentType: file.type || null,
      size: file.size,
    })
    .returning({ id: attachments.id, name: attachments.name, url: attachments.url, contentType: attachments.contentType, size: attachments.size, createdAt: attachments.createdAt });
  apiInvalidateAttachments(issueId);
  return created;
}
