"use server";

import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  cycles,
  initiatives,
  issueLabels,
  issuePageLinks,
  issues,
  pages,
  projects,
} from "@/db/schema";
import { getCurrentUser, getWorkspace } from "@/lib/data";
import { isPriority, isStatus } from "@/lib/constants";

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
    cycleId: string | null;
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
  if (patch.cycleId !== undefined) values.cycleId = patch.cycleId;
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

// ---- Cycles ----

export async function createCycle(input: {
  name?: string;
  startDate: string;
  endDate: string;
}) {
  const ws = await getWorkspace();
  const [{ value: maxNumber }] = await db
    .select({ value: max(cycles.number) })
    .from(cycles)
    .where(eq(cycles.workspaceId, ws.id));
  const number = (maxNumber ?? 0) + 1;
  const [created] = await db
    .insert(cycles)
    .values({
      workspaceId: ws.id,
      name: input.name?.trim() || `Cycle ${number}`,
      number,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
    })
    .returning();
  revalidatePath("/cycles");
  return created;
}

export async function updateCycle(
  id: string,
  patch: Partial<{ name: string; startDate: string; endDate: string }>,
) {
  const ws = await getWorkspace();
  const values: Record<string, unknown> = {};
  if (patch.name !== undefined) values.name = patch.name;
  if (patch.startDate !== undefined) values.startDate = new Date(patch.startDate);
  if (patch.endDate !== undefined) values.endDate = new Date(patch.endDate);
  await db
    .update(cycles)
    .set(values)
    .where(and(eq(cycles.workspaceId, ws.id), eq(cycles.id, id)));
  revalidatePath("/cycles");
  revalidatePath(`/cycles/${id}`);
}

export async function deleteCycle(id: string) {
  const ws = await getWorkspace();
  await db.delete(cycles).where(and(eq(cycles.workspaceId, ws.id), eq(cycles.id, id)));
  revalidatePath("/cycles");
}

// ---- Initiatives ----

export async function createInitiative(input: { name?: string }) {
  const ws = await getWorkspace();
  const [created] = await db
    .insert(initiatives)
    .values({
      workspaceId: ws.id,
      name: input.name?.trim() || "New initiative",
    })
    .returning();
  revalidatePath("/initiatives");
  return created;
}

export async function updateInitiative(
  id: string,
  patch: Partial<{
    name: string;
    description: string;
    status: string;
    color: string;
  }>,
) {
  const ws = await getWorkspace();
  await db
    .update(initiatives)
    .set(patch)
    .where(and(eq(initiatives.workspaceId, ws.id), eq(initiatives.id, id)));
  revalidatePath("/initiatives");
  revalidatePath(`/initiatives/${id}`);
}

export async function deleteInitiative(id: string) {
  const ws = await getWorkspace();
  await db
    .delete(initiatives)
    .where(and(eq(initiatives.workspaceId, ws.id), eq(initiatives.id, id)));
  revalidatePath("/initiatives");
}

/** Move a project into (or out of) an initiative. */
export async function setProjectInitiative(
  projectId: string,
  initiativeId: string | null,
) {
  const ws = await getWorkspace();
  await db
    .update(projects)
    .set({ initiativeId })
    .where(and(eq(projects.workspaceId, ws.id), eq(projects.id, projectId)));
  revalidatePath("/initiatives");
}
