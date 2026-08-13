import "server-only";

import { and, desc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import {
  attachments,
  comments,
  issuePageLinks,
  issueRelations,
  issues,
  notifications,
  pageComments,
  pageVersions,
  pages,
  users,
} from "@/db/schema";
import { docToText } from "@/lib/markdown";

/**
 * Reads and writes for the collaboration surfaces: issue comment threads, the
 * issue relationship graph, issue↔page links, page comments and version
 * history, attachments and notifications.
 *
 * These deliberately take an explicit workspaceId/userId rather than reusing
 * the app's data helpers, several of which resolve the current user from
 * cookies and would have no session on an API-key request.
 */

async function assertIssue(workspaceId: string, issueId: string): Promise<void> {
  const [row] = await db
    .select({ id: issues.id })
    .from(issues)
    .where(and(eq(issues.workspaceId, workspaceId), eq(issues.id, issueId)))
    .limit(1);
  if (!row) throw new Error("Issue not found.");
}

async function assertPage(workspaceId: string, pageId: string): Promise<void> {
  const [row] = await db
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.workspaceId, workspaceId), eq(pages.id, pageId)))
    .limit(1);
  if (!row) throw new Error("Page not found.");
}

// ---- Issue comments ----

export async function apiListIssueComments(workspaceId: string, issueId: string) {
  await assertIssue(workspaceId, issueId);
  const rows = await db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      authorId: users.id,
      authorName: users.name,
    })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id))
    .where(and(eq(comments.workspaceId, workspaceId), eq(comments.issueId, issueId)))
    .orderBy(comments.createdAt);
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    author: r.authorId ? { id: r.authorId, name: r.authorName } : null,
    createdAt: r.createdAt,
  }));
}

export async function apiDeleteIssueComment(
  workspaceId: string,
  commentId: string,
): Promise<boolean> {
  const res = await db
    .delete(comments)
    .where(and(eq(comments.workspaceId, workspaceId), eq(comments.id, commentId)))
    .returning({ id: comments.id });
  return res.length > 0;
}

// ---- Issue relationships ----

const RELATION_TYPES = ["blocks", "blocked_by", "related", "duplicate"];

/** `blocked_by` is stored as the inverse `blocks` edge so the graph has one
 *  direction per pair, matching the in-app behaviour. */
export async function apiAddIssueRelation(
  workspaceId: string,
  issueId: string,
  input: { relatedIssueId?: string; type?: string },
): Promise<string> {
  const type = input.type ?? "related";
  if (!RELATION_TYPES.includes(type))
    throw new Error(`\`type\` must be one of: ${RELATION_TYPES.join(", ")}.`);
  const relatedIssueId = input.relatedIssueId;
  if (!relatedIssueId) throw new Error("`relatedIssueId` is required.");
  if (relatedIssueId === issueId)
    throw new Error("An issue cannot be related to itself.");

  await Promise.all([
    assertIssue(workspaceId, issueId),
    assertIssue(workspaceId, relatedIssueId),
  ]);

  const [from, to, stored] =
    type === "blocked_by"
      ? [relatedIssueId, issueId, "blocks"]
      : [issueId, relatedIssueId, type];

  const [created] = await db
    .insert(issueRelations)
    .values({ workspaceId, issueId: from, relatedIssueId: to, type: stored })
    .returning({ id: issueRelations.id });
  return created.id;
}

export async function apiListIssueRelations(workspaceId: string, issueId: string) {
  await assertIssue(workspaceId, issueId);
  const rows = await db
    .select()
    .from(issueRelations)
    .where(
      and(
        eq(issueRelations.workspaceId, workspaceId),
        or(
          eq(issueRelations.issueId, issueId),
          eq(issueRelations.relatedIssueId, issueId),
        ),
      ),
    );
  return rows.map((r) => {
    const outgoing = r.issueId === issueId;
    return {
      id: r.id,
      // Show the edge from this issue's point of view.
      type: outgoing ? r.type : r.type === "blocks" ? "blocked_by" : r.type,
      issueId: outgoing ? r.relatedIssueId : r.issueId,
    };
  });
}

export async function apiDeleteIssueRelation(
  workspaceId: string,
  relationId: string,
): Promise<boolean> {
  const res = await db
    .delete(issueRelations)
    .where(
      and(eq(issueRelations.workspaceId, workspaceId), eq(issueRelations.id, relationId)),
    )
    .returning({ id: issueRelations.id });
  return res.length > 0;
}

// ---- Issue <-> page links ----

export async function apiLinkIssuePage(
  workspaceId: string,
  issueId: string,
  pageId: string,
): Promise<void> {
  await Promise.all([assertIssue(workspaceId, issueId), assertPage(workspaceId, pageId)]);
  await db.insert(issuePageLinks).values({ issueId, pageId }).onConflictDoNothing();
}

export async function apiUnlinkIssuePage(
  workspaceId: string,
  issueId: string,
  pageId: string,
): Promise<boolean> {
  await assertIssue(workspaceId, issueId);
  const res = await db
    .delete(issuePageLinks)
    .where(and(eq(issuePageLinks.issueId, issueId), eq(issuePageLinks.pageId, pageId)))
    .returning({ issueId: issuePageLinks.issueId });
  return res.length > 0;
}

// ---- Page comments ----

export async function apiListPageComments(workspaceId: string, pageId: string) {
  await assertPage(workspaceId, pageId);
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
    .where(
      and(eq(pageComments.workspaceId, workspaceId), eq(pageComments.pageId, pageId)),
    )
    .orderBy(pageComments.createdAt);
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    parentId: r.parentId,
    blockId: r.blockId,
    resolved: r.resolvedAt != null,
    author: r.authorId ? { id: r.authorId, name: r.authorName } : null,
    createdAt: r.createdAt,
  }));
}

export async function apiCreatePageComment(
  workspaceId: string,
  userId: string | null,
  pageId: string,
  input: { body?: string; parentId?: string | null; blockId?: string | null },
): Promise<string> {
  await assertPage(workspaceId, pageId);
  const body = input.body?.trim();
  if (!body) throw new Error("`body` is required.");
  const [created] = await db
    .insert(pageComments)
    .values({
      workspaceId,
      pageId,
      parentId: input.parentId || null,
      blockId: input.blockId || null,
      authorId: userId,
      body,
    })
    .returning({ id: pageComments.id });
  return created.id;
}

export async function apiResolvePageComment(
  workspaceId: string,
  commentId: string,
  resolved: boolean,
): Promise<boolean> {
  const res = await db
    .update(pageComments)
    .set({ resolvedAt: resolved ? new Date() : null })
    .where(
      and(eq(pageComments.workspaceId, workspaceId), eq(pageComments.id, commentId)),
    )
    .returning({ id: pageComments.id });
  return res.length > 0;
}

// ---- Page version history ----

export async function apiListPageVersions(workspaceId: string, pageId: string) {
  await assertPage(workspaceId, pageId);
  return db
    .select({
      id: pageVersions.id,
      title: pageVersions.title,
      createdAt: pageVersions.createdAt,
    })
    .from(pageVersions)
    .where(
      and(eq(pageVersions.workspaceId, workspaceId), eq(pageVersions.pageId, pageId)),
    )
    .orderBy(desc(pageVersions.createdAt));
}

/** Roll a page back to a snapshot, saving the current state first so the
 *  restore is itself undoable. */
export async function apiRestorePageVersion(
  workspaceId: string,
  pageId: string,
  versionId: string,
): Promise<boolean> {
  const [version] = await db
    .select({ title: pageVersions.title, content: pageVersions.content })
    .from(pageVersions)
    .where(
      and(
        eq(pageVersions.workspaceId, workspaceId),
        eq(pageVersions.pageId, pageId),
        eq(pageVersions.id, versionId),
      ),
    )
    .limit(1);
  if (!version) return false;

  const [current] = await db
    .select({ title: pages.title, content: pages.content })
    .from(pages)
    .where(and(eq(pages.workspaceId, workspaceId), eq(pages.id, pageId)))
    .limit(1);
  if (!current) return false;

  await db.insert(pageVersions).values({
    workspaceId,
    pageId,
    title: current.title,
    content: current.content,
  });

  await db
    .update(pages)
    .set({
      title: version.title,
      content: version.content,
      contentText: docToText(version.content).slice(0, 20000),
      updatedAt: new Date(),
    })
    .where(and(eq(pages.workspaceId, workspaceId), eq(pages.id, pageId)));
  return true;
}

// ---- Trash ----

export async function apiListTrashedPages(workspaceId: string) {
  return db
    .select({
      id: pages.id,
      title: pages.title,
      icon: pages.icon,
      deletedAt: pages.deletedAt,
    })
    .from(pages)
    .where(and(eq(pages.workspaceId, workspaceId), isNotNull(pages.deletedAt)))
    .orderBy(desc(pages.deletedAt));
}

/** Restore a trashed page and any of its descendants that went down with it. */
export async function apiRestorePage(
  workspaceId: string,
  id: string,
): Promise<boolean> {
  const [target] = await db
    .select({ id: pages.id })
    .from(pages)
    .where(
      and(
        eq(pages.workspaceId, workspaceId),
        eq(pages.id, id),
        isNotNull(pages.deletedAt),
      ),
    )
    .limit(1);
  if (!target) return false;

  const all = await db
    .select({ id: pages.id, parentId: pages.parentId })
    .from(pages)
    .where(eq(pages.workspaceId, workspaceId));
  const childrenOf = new Map<string | null, string[]>();
  for (const p of all) {
    const arr = childrenOf.get(p.parentId) ?? [];
    arr.push(p.id);
    childrenOf.set(p.parentId, arr);
  }
  const ids: string[] = [];
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    ids.push(cur);
    for (const child of childrenOf.get(cur) ?? []) stack.push(child);
  }

  await db
    .update(pages)
    .set({ deletedAt: null })
    .where(and(eq(pages.workspaceId, workspaceId), inArray(pages.id, ids)));
  return true;
}

/** Permanently delete a page that is already in the trash. */
export async function apiPurgePage(
  workspaceId: string,
  id: string,
): Promise<boolean> {
  const res = await db
    .delete(pages)
    .where(
      and(
        eq(pages.workspaceId, workspaceId),
        eq(pages.id, id),
        isNotNull(pages.deletedAt),
      ),
    )
    .returning({ id: pages.id });
  return res.length > 0;
}

// ---- Attachments ----

export async function apiListAttachments(workspaceId: string, issueId: string) {
  await assertIssue(workspaceId, issueId);
  return db
    .select({
      id: attachments.id,
      name: attachments.name,
      url: attachments.url,
      contentType: attachments.contentType,
      size: attachments.size,
      createdAt: attachments.createdAt,
    })
    .from(attachments)
    .where(
      and(eq(attachments.workspaceId, workspaceId), eq(attachments.issueId, issueId)),
    )
    .orderBy(desc(attachments.createdAt));
}

/** Register an already-hosted file against an issue. Binary upload stays in
 *  the app (it needs multipart + blob storage); this links a known URL. */
export async function apiAddAttachment(
  workspaceId: string,
  userId: string | null,
  issueId: string,
  input: { name?: string; url?: string; contentType?: string | null; size?: number },
): Promise<string> {
  await assertIssue(workspaceId, issueId);
  const name = input.name?.trim();
  const url = input.url?.trim();
  if (!name) throw new Error("`name` is required.");
  if (!url || !/^https?:\/\//.test(url))
    throw new Error("`url` must be an http(s) URL.");

  const [created] = await db
    .insert(attachments)
    .values({
      workspaceId,
      issueId,
      uploaderId: userId,
      name: name.slice(0, 300),
      url,
      contentType: input.contentType ?? null,
      size: input.size ?? 0,
    })
    .returning({ id: attachments.id });
  return created.id;
}

// ---- Notifications ----

export async function apiListNotifications(
  workspaceId: string,
  userId: string | null,
  opts: { unreadOnly?: boolean } = {},
) {
  if (!userId) return [];
  const conds = [
    eq(notifications.workspaceId, workspaceId),
    eq(notifications.userId, userId),
  ];
  if (opts.unreadOnly) conds.push(isNull(notifications.read));
  return db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      issueId: notifications.issueId,
      read: notifications.read,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(and(...conds))
    .orderBy(desc(notifications.createdAt))
    .limit(100);
}

/** Mark one notification read, or all of this member's when no id is given. */
export async function apiMarkNotificationsRead(
  workspaceId: string,
  userId: string | null,
  id?: string,
): Promise<number> {
  if (!userId) return 0;
  const conds = [
    eq(notifications.workspaceId, workspaceId),
    eq(notifications.userId, userId),
    isNull(notifications.read),
  ];
  if (id) conds.push(eq(notifications.id, id));
  const res = await db
    .update(notifications)
    .set({ read: new Date() })
    .where(and(...conds))
    .returning({ id: notifications.id });
  return res.length;
}
