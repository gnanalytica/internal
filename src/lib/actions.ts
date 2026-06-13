"use server";

import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { db } from "@/db";
import {
  issueLabels,
  issuePageLinks,
  issues,
  pages,
} from "@/db/schema";
import { getCurrentUser, getWorkspace } from "@/lib/data";
import { isPriority, isStatus } from "@/lib/constants";

/** Switch the active user (minimal session). */
export async function setCurrentUser(userId: string) {
  (await cookies()).set("uid", userId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}

// ---- Issues ----

export async function createIssue(input: {
  title: string;
  projectId?: string | null;
  status?: string;
  priority?: string;
  assigneeId?: string | null;
}) {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);

  const [{ value: maxNumber }] = await db
    .select({ value: max(issues.number) })
    .from(issues)
    .where(
      input.projectId
        ? and(eq(issues.workspaceId, ws.id), eq(issues.projectId, input.projectId))
        : eq(issues.workspaceId, ws.id),
    );

  const [created] = await db
    .insert(issues)
    .values({
      workspaceId: ws.id,
      projectId: input.projectId ?? null,
      number: (maxNumber ?? 0) + 1,
      title: input.title.trim() || "Untitled issue",
      status: input.status && isStatus(input.status) ? input.status : "backlog",
      priority: input.priority && isPriority(input.priority) ? input.priority : "none",
      assigneeId: input.assigneeId ?? null,
      creatorId: me.id,
      sortKey: `a${Date.now()}`,
    })
    .returning();

  revalidatePath("/issues");
  return created;
}

export async function updateIssue(
  id: string,
  patch: Partial<{
    title: string;
    description: unknown;
    status: string;
    priority: string;
    assigneeId: string | null;
    projectId: string | null;
    sortKey: string;
  }>,
) {
  const ws = await getWorkspace();
  const values: Record<string, unknown> = { updatedAt: new Date() };

  if (patch.title !== undefined) values.title = patch.title;
  if (patch.description !== undefined) values.description = patch.description;
  if (patch.status !== undefined && isStatus(patch.status)) values.status = patch.status;
  if (patch.priority !== undefined && isPriority(patch.priority))
    values.priority = patch.priority;
  if (patch.assigneeId !== undefined) values.assigneeId = patch.assigneeId;
  if (patch.projectId !== undefined) values.projectId = patch.projectId;
  if (patch.sortKey !== undefined) values.sortKey = patch.sortKey;

  await db
    .update(issues)
    .set(values)
    .where(and(eq(issues.workspaceId, ws.id), eq(issues.id, id)));

  revalidatePath("/issues");
  revalidatePath(`/issues/${id}`);
}

export async function deleteIssue(id: string) {
  const ws = await getWorkspace();
  await db.delete(issues).where(and(eq(issues.workspaceId, ws.id), eq(issues.id, id)));
  revalidatePath("/issues");
}

export async function setIssueLabels(issueId: string, labelIds: string[]) {
  await db.delete(issueLabels).where(eq(issueLabels.issueId, issueId));
  if (labelIds.length) {
    await db.insert(issueLabels).values(labelIds.map((labelId) => ({ issueId, labelId })));
  }
  revalidatePath("/issues");
  revalidatePath(`/issues/${issueId}`);
}

// ---- Pages ----

export async function createPage(parentId?: string | null) {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const [created] = await db
    .insert(pages)
    .values({
      workspaceId: ws.id,
      parentId: parentId ?? null,
      title: "Untitled",
      creatorId: me.id,
      position: `a${Date.now()}`,
    })
    .returning();
  revalidatePath("/", "layout");
  return created;
}

export async function updatePage(
  id: string,
  patch: Partial<{ title: string; icon: string; content: unknown }>,
) {
  const ws = await getWorkspace();
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.title !== undefined) values.title = patch.title;
  if (patch.icon !== undefined) values.icon = patch.icon;
  if (patch.content !== undefined) values.content = patch.content;

  await db
    .update(pages)
    .set(values)
    .where(and(eq(pages.workspaceId, ws.id), eq(pages.id, id)));

  revalidatePath("/", "layout");
  revalidatePath(`/pages/${id}`);
}

export async function deletePage(id: string) {
  const ws = await getWorkspace();
  await db.delete(pages).where(and(eq(pages.workspaceId, ws.id), eq(pages.id, id)));
  revalidatePath("/", "layout");
}

// ---- Issue <-> Page links ----

export async function linkIssueToPage(issueId: string, pageId: string) {
  await db.insert(issuePageLinks).values({ issueId, pageId }).onConflictDoNothing();
  revalidatePath(`/issues/${issueId}`);
  revalidatePath(`/pages/${pageId}`);
}

export async function unlinkIssueFromPage(issueId: string, pageId: string) {
  await db
    .delete(issuePageLinks)
    .where(and(eq(issuePageLinks.issueId, issueId), eq(issuePageLinks.pageId, pageId)));
  revalidatePath(`/issues/${issueId}`);
  revalidatePath(`/pages/${pageId}`);
}
