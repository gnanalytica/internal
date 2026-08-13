import "server-only";

import { and, desc, eq, ilike, inArray, isNull, max, or } from "drizzle-orm";

import { db } from "@/db";
import {
  activity,
  comments,
  cycles,
  features,
  issueAssignees,
  issueLabels,
  issues,
  labels,
  milestones,
  pages,
  projects,
  users,
} from "@/db/schema";
import {
  isIssueType,
  isMilestoneStatus,
  isPriority,
  isStatus,
} from "@/lib/constants";
import { dispatchWebhook } from "@/lib/api/webhooks";
import { docToText, markdownToDoc } from "@/lib/markdown";

/** API clients send Markdown; the editor stores TipTap JSON. */
function textToDoc(text: string): unknown {
  return markdownToDoc(text ?? "");
}

const toDate = (v: unknown): Date | null => {
  if (v == null || v === "") return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new Error("Expected an ISO date.");
  return d;
};

/** Normalise an optional foreign key. `??` alone lets "" through to a uuid
 *  column, which fails as a raw driver error rather than a clear message. */
const toRef = (v: unknown): string | null =>
  v == null || v === "" ? null : String(v);

/**
 * Foreign keys reference a row by id but not by workspace, so a bad id would
 * otherwise link silently across workspaces (or fail with a raw PG error).
 * Check the id belongs here and give the caller a message it can act on.
 */
const REFERENCES = {
  project: projects,
  cycle: cycles,
  milestone: milestones,
  feature: features,
  issue: issues,
  user: users,
} as const;

async function assertRef(
  workspaceId: string,
  kind: keyof typeof REFERENCES,
  id: string | null | undefined,
): Promise<void> {
  if (!id) return;
  const table = REFERENCES[kind] as unknown as { workspaceId: never; id: never };
  // Users are global; membership is what matters, and every member of this
  // single-workspace app is reachable, so an existence check is enough.
  const where =
    kind === "user"
      ? eq(table.id, id as never)
      : and(eq(table.workspaceId, workspaceId), eq(table.id, id as never));
  const [row] = await db
    .select({ id: table.id })
    .from(REFERENCES[kind])
    .where(where)
    .limit(1);
  if (!row) throw new Error(`\`${kind}Id\`: ${kind} not found in this workspace.`);
}

/** Replace an issue's labels, rejecting ids from another workspace. */
async function setIssueLabels(
  workspaceId: string,
  issueId: string,
  labelIds: string[],
): Promise<void> {
  const ids = [...new Set(labelIds.filter(Boolean))];
  if (ids.length > 0) {
    const found = await db
      .select({ id: labels.id })
      .from(labels)
      .where(and(eq(labels.workspaceId, workspaceId), inArray(labels.id, ids)));
    if (found.length !== ids.length)
      throw new Error("`labelIds`: one or more labels are not in this workspace.");
  }
  await db.delete(issueLabels).where(eq(issueLabels.issueId, issueId));
  if (ids.length > 0)
    await db
      .insert(issueLabels)
      .values(ids.map((labelId) => ({ issueId, labelId })))
      .onConflictDoNothing();
}

/** Keep the multi-assignee set in step with the primary assignee, the way the
 *  in-app actions do — the issue detail reads assignees from the join table. */
async function syncPrimaryAssignee(
  issueId: string,
  assigneeId: string | null,
): Promise<void> {
  await db.delete(issueAssignees).where(eq(issueAssignees.issueId, issueId));
  if (assigneeId)
    await db
      .insert(issueAssignees)
      .values({ issueId, userId: assigneeId })
      .onConflictDoNothing();
}

export async function apiCreateIssue(
  workspaceId: string,
  userId: string | null,
  input: {
    title: string;
    projectId?: string | null;
    type?: string;
    status?: string;
    priority?: string;
    assigneeId?: string | null;
    cycleId?: string | null;
    milestoneId?: string | null;
    featureId?: string | null;
    parentId?: string | null;
    labelIds?: string[];
    estimate?: number | null;
    startDate?: string | null;
    dueDate?: string | null;
    description?: string;
  },
): Promise<string> {
  const title = input.title?.trim();
  if (!title) throw new Error("`title` is required.");
  if (input.type && !isIssueType(input.type))
    throw new Error(
      "`type` must be one of: engineering, product, research, marketing, sales, ops, legal, finance, people, admin.",
    );

  const refs = {
    projectId: toRef(input.projectId),
    cycleId: toRef(input.cycleId),
    milestoneId: toRef(input.milestoneId),
    featureId: toRef(input.featureId),
    parentId: toRef(input.parentId),
    assigneeId: toRef(input.assigneeId),
  };

  await Promise.all([
    assertRef(workspaceId, "project", refs.projectId),
    assertRef(workspaceId, "cycle", refs.cycleId),
    assertRef(workspaceId, "milestone", refs.milestoneId),
    assertRef(workspaceId, "feature", refs.featureId),
    assertRef(workspaceId, "issue", refs.parentId),
    assertRef(workspaceId, "user", refs.assigneeId),
  ]);

  const [{ value: maxNumber }] = await db
    .select({ value: max(issues.number) })
    .from(issues)
    .where(
      refs.projectId
        ? and(eq(issues.workspaceId, workspaceId), eq(issues.projectId, refs.projectId))
        : eq(issues.workspaceId, workspaceId),
    );

  const [created] = await db
    .insert(issues)
    .values({
      workspaceId,
      projectId: refs.projectId,
      cycleId: refs.cycleId,
      milestoneId: refs.milestoneId,
      featureId: refs.featureId,
      parentId: refs.parentId,
      number: (maxNumber ?? 0) + 1,
      title: title.slice(0, 500),
      // Work isn't only engineering — this is the department lens on a task.
      type: input.type && isIssueType(input.type) ? input.type : "engineering",
      status: input.status && isStatus(input.status) ? input.status : "backlog",
      priority: input.priority && isPriority(input.priority) ? input.priority : "none",
      assigneeId: refs.assigneeId,
      estimate: input.estimate ?? null,
      startDate: toDate(input.startDate),
      dueDate: toDate(input.dueDate),
      description: input.description ? textToDoc(input.description) : null,
      creatorId: userId,
      sortKey: `a${Date.now()}`,
    })
    .returning();

  if (refs.assigneeId) await syncPrimaryAssignee(created.id, refs.assigneeId);
  if (input.labelIds?.length)
    await setIssueLabels(workspaceId, created.id, input.labelIds);

  await db.insert(activity).values({
    workspaceId,
    issueId: created.id,
    actorId: userId,
    type: "created",
    data: null,
  });

  await dispatchWebhook(workspaceId, "issue.created", {
    id: created.id,
    title: created.title,
    status: created.status,
    priority: created.priority,
  });

  return created.id;
}

export async function apiUpdateIssue(
  workspaceId: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  if (typeof patch.type === "string" && !isIssueType(patch.type))
    throw new Error(
      "`type` must be one of: engineering, product, research, marketing, sales, ops, legal, finance, people, admin.",
    );
  if (patch.parentId && patch.parentId === id)
    throw new Error("`parentId`: an issue cannot be its own parent.");

  await Promise.all([
    assertRef(workspaceId, "project", toRef(patch.projectId)),
    assertRef(workspaceId, "cycle", toRef(patch.cycleId)),
    assertRef(workspaceId, "milestone", toRef(patch.milestoneId)),
    assertRef(workspaceId, "feature", toRef(patch.featureId)),
    assertRef(workspaceId, "issue", toRef(patch.parentId)),
    assertRef(workspaceId, "user", toRef(patch.assigneeId)),
  ]);

  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof patch.title === "string") values.title = patch.title.trim() || "Untitled";
  if (typeof patch.type === "string") values.type = patch.type;
  if (typeof patch.status === "string" && isStatus(patch.status)) values.status = patch.status;
  if (typeof patch.priority === "string" && isPriority(patch.priority))
    values.priority = patch.priority;
  if ("assigneeId" in patch) values.assigneeId = toRef(patch.assigneeId);
  if ("projectId" in patch) values.projectId = toRef(patch.projectId);
  if ("cycleId" in patch) values.cycleId = toRef(patch.cycleId);
  if ("milestoneId" in patch) values.milestoneId = toRef(patch.milestoneId);
  if ("featureId" in patch) values.featureId = toRef(patch.featureId);
  if ("parentId" in patch) values.parentId = toRef(patch.parentId);
  if ("estimate" in patch) values.estimate = patch.estimate ?? null;
  if ("startDate" in patch) values.startDate = toDate(patch.startDate);
  if ("dueDate" in patch) values.dueDate = toDate(patch.dueDate);
  if (typeof patch.description === "string") values.description = textToDoc(patch.description);

  const res = await db
    .update(issues)
    .set(values)
    .where(and(eq(issues.workspaceId, workspaceId), eq(issues.id, id)))
    .returning({ id: issues.id });
  if (res.length === 0) return false;

  if ("assigneeId" in patch)
    await syncPrimaryAssignee(id, toRef(patch.assigneeId));
  if (Array.isArray(patch.labelIds))
    await setIssueLabels(workspaceId, id, patch.labelIds as string[]);

  await dispatchWebhook(workspaceId, "issue.updated", { id, ...patch });
  return true;
}

export async function apiDeleteIssue(workspaceId: string, id: string): Promise<boolean> {
  const res = await db
    .delete(issues)
    .where(and(eq(issues.workspaceId, workspaceId), eq(issues.id, id)))
    .returning({ id: issues.id });
  if (res.length > 0) await dispatchWebhook(workspaceId, "issue.deleted", { id });
  return res.length > 0;
}

export async function apiCreateComment(
  workspaceId: string,
  userId: string | null,
  issueId: string,
  body: string,
): Promise<string> {
  const text = body?.trim();
  if (!text) throw new Error("`body` is required.");
  const [issue] = await db
    .select({ id: issues.id })
    .from(issues)
    .where(and(eq(issues.workspaceId, workspaceId), eq(issues.id, issueId)))
    .limit(1);
  if (!issue) throw new Error("Issue not found.");
  const [created] = await db
    .insert(comments)
    .values({ workspaceId, issueId, authorId: userId, body: text })
    .returning();
  await dispatchWebhook(workspaceId, "issue.commented", {
    issueId,
    commentId: created.id,
    body: text,
  });
  return created.id;
}

const PROJECT_COLORS = [
  "#6366f1", "#ec4899", "#10b981", "#f59e0b", "#3b82f6",
  "#a855f7", "#ef4444", "#14b8a6", "#f97316", "#8b5cf6",
];

export async function apiCreateProject(
  workspaceId: string,
  input: { name: string; key?: string; description?: string },
): Promise<string> {
  const name = input.name?.trim();
  if (!name) throw new Error("`name` is required.");
  const base =
    (input.key?.trim() || name.replace(/[^A-Za-z0-9]/g, "").slice(0, 4) || "PRJ")
      .toUpperCase()
      .slice(0, 6) || "PRJ";
  const existing = await db
    .select({ key: projects.key })
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId));
  const taken = new Set(existing.map((p) => p.key));
  let key = base;
  let n = 1;
  while (taken.has(key)) key = `${base}${n++}`;

  const [created] = await db
    .insert(projects)
    .values({
      workspaceId,
      name,
      key,
      description: input.description ?? null,
      color: PROJECT_COLORS[taken.size % PROJECT_COLORS.length],
    })
    .returning();
  await dispatchWebhook(workspaceId, "project.created", {
    id: created.id,
    name: created.name,
    key: created.key,
  });
  return created.id;
}

export async function apiCreatePage(
  workspaceId: string,
  userId: string | null,
  input: {
    title: string;
    content?: string;
    icon?: string;
    parentId?: string | null;
    projectId?: string | null;
  },
): Promise<string> {
  // A sub-page inherits its parent's scope (company wiki vs a project's Docs),
  // mirroring the in-app `createPage` action.
  let scope = input.projectId ?? null;
  if (input.parentId) {
    const [parent] = await db
      .select({ projectId: pages.projectId })
      .from(pages)
      .where(and(eq(pages.workspaceId, workspaceId), eq(pages.id, input.parentId)))
      .limit(1);
    if (!parent) throw new Error("Parent page not found.");
    scope = parent.projectId;
  }

  const doc = input.content ? textToDoc(input.content) : null;
  const [created] = await db
    .insert(pages)
    .values({
      workspaceId,
      title: input.title?.trim() || "Untitled",
      icon: input.icon?.trim() || "📄",
      parentId: input.parentId ?? null,
      projectId: scope,
      content: doc,
      contentText: docToText(doc).slice(0, 20000),
      creatorId: userId,
      position: `a${Date.now()}`,
    })
    .returning();
  await dispatchWebhook(workspaceId, "page.created", {
    id: created.id,
    title: created.title,
  });
  return created.id;
}

export async function apiUpdatePage(
  workspaceId: string,
  id: string,
  patch: { title?: string; icon?: string; content?: string },
): Promise<boolean> {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof patch.title === "string") values.title = patch.title.trim() || "Untitled";
  if (typeof patch.icon === "string" && patch.icon.trim()) values.icon = patch.icon.trim();
  if (typeof patch.content === "string") {
    const doc = textToDoc(patch.content);
    values.content = doc;
    values.contentText = docToText(doc).slice(0, 20000);
  }

  const res = await db
    .update(pages)
    .set(values)
    .where(
      and(eq(pages.workspaceId, workspaceId), eq(pages.id, id), isNull(pages.deletedAt)),
    )
    .returning({ id: pages.id, title: pages.title });
  if (res.length > 0)
    await dispatchWebhook(workspaceId, "page.updated", { id, title: res[0].title });
  return res.length > 0;
}

/**
 * Move a page (and its descendants) to the trash. Soft delete, matching the
 * in-app behaviour so an agent's mistake stays recoverable from /trash.
 */
export async function apiDeletePage(
  workspaceId: string,
  id: string,
): Promise<boolean> {
  const [target] = await db
    .select({ id: pages.id })
    .from(pages)
    .where(
      and(eq(pages.workspaceId, workspaceId), eq(pages.id, id), isNull(pages.deletedAt)),
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
    .set({ deletedAt: new Date() })
    .where(and(eq(pages.workspaceId, workspaceId), inArray(pages.id, ids)));
  await dispatchWebhook(workspaceId, "page.deleted", { id, count: ids.length });
  return true;
}

export type ApiSearchHit = { type: string; id: string; title: string; url: string };

export async function apiSearch(
  workspaceId: string,
  q: string,
): Promise<ApiSearchHit[]> {
  const term = `%${q.trim()}%`;
  if (!q.trim()) return [];
  const base = process.env.NEXT_PUBLIC_APP_URL || "";
  const [issueRows, pageRows, projectRows] = await Promise.all([
    db
      .select({ id: issues.id, title: issues.title })
      .from(issues)
      .where(and(eq(issues.workspaceId, workspaceId), ilike(issues.title, term)))
      .orderBy(desc(issues.createdAt))
      .limit(10),
    db
      .select({ id: pages.id, title: pages.title })
      .from(pages)
      .where(
        and(
          eq(pages.workspaceId, workspaceId),
          or(ilike(pages.title, term), ilike(pages.contentText, term)),
        ),
      )
      .limit(10),
    db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(and(eq(projects.workspaceId, workspaceId), ilike(projects.name, term)))
      .limit(10),
  ]);

  return [
    ...issueRows.map((r) => ({ type: "issue", id: r.id, title: r.title, url: `${base}/issues/${r.id}` })),
    ...pageRows.map((r) => ({ type: "page", id: r.id, title: r.title || "Untitled", url: `${base}/pages/${r.id}` })),
    ...projectRows.map((r) => ({ type: "project", id: r.id, title: r.name, url: `${base}/projects/${r.id}` })),
  ];
}

// ---- Planning: milestones, features, cycles, labels ----

export async function apiCreateMilestone(
  workspaceId: string,
  input: {
    name?: string;
    projectId?: string;
    description?: string | null;
    targetDate?: string | null;
    status?: string;
  },
): Promise<string> {
  const name = input.name?.trim();
  if (!name) throw new Error("`name` is required.");
  if (!input.projectId) throw new Error("`projectId` is required for a milestone.");
  if (input.status && !isMilestoneStatus(input.status))
    throw new Error(
      "`status` must be one of: planned, on_track, at_risk, off_track, achieved, missed.",
    );
  await assertRef(workspaceId, "project", input.projectId);

  const [created] = await db
    .insert(milestones)
    .values({
      workspaceId,
      projectId: input.projectId,
      name: name.slice(0, 200),
      description: input.description ?? null,
      targetDate: toDate(input.targetDate),
      status: input.status ?? "planned",
      sortKey: `a${Date.now()}`,
    })
    .returning({ id: milestones.id });
  return created.id;
}

const FEATURE_STATUSES = ["idea", "planned", "building", "shipped", "archived"];

export async function apiCreateFeature(
  workspaceId: string,
  input: {
    title?: string;
    projectId?: string | null;
    milestoneId?: string | null;
    status?: string;
    startDate?: string | null;
    targetDate?: string | null;
    ownerId?: string | null;
  },
): Promise<string> {
  const title = input.title?.trim();
  if (!title) throw new Error("`title` is required.");
  if (input.status && !FEATURE_STATUSES.includes(input.status))
    throw new Error(`\`status\` must be one of: ${FEATURE_STATUSES.join(", ")}.`);

  await Promise.all([
    assertRef(workspaceId, "project", toRef(input.projectId)),
    assertRef(workspaceId, "milestone", toRef(input.milestoneId)),
    assertRef(workspaceId, "user", toRef(input.ownerId)),
  ]);

  const [created] = await db
    .insert(features)
    .values({
      workspaceId,
      projectId: toRef(input.projectId),
      milestoneId: toRef(input.milestoneId),
      title: title.slice(0, 300),
      status: input.status ?? "idea",
      startDate: toDate(input.startDate),
      targetDate: toDate(input.targetDate),
      ownerId: toRef(input.ownerId),
      sortKey: `a${Date.now()}`,
    })
    .returning({ id: features.id });
  return created.id;
}

export async function apiCreateCycle(
  workspaceId: string,
  input: {
    name?: string;
    projectId?: string;
    startDate?: string | null;
    endDate?: string | null;
  },
): Promise<string> {
  const name = input.name?.trim();
  if (!name) throw new Error("`name` is required.");
  if (!input.projectId) throw new Error("`projectId` is required for a cycle.");
  const startDate = toDate(input.startDate);
  const endDate = toDate(input.endDate);
  if (!startDate || !endDate)
    throw new Error("`startDate` and `endDate` are required for a cycle.");
  if (endDate < startDate) throw new Error("`endDate` must be on or after `startDate`.");
  await assertRef(workspaceId, "project", input.projectId);

  // Cycle numbers run per project, like the app's own cycle creation.
  const [{ value: maxNumber }] = await db
    .select({ value: max(cycles.number) })
    .from(cycles)
    .where(
      and(eq(cycles.workspaceId, workspaceId), eq(cycles.projectId, input.projectId)),
    );

  const [created] = await db
    .insert(cycles)
    .values({
      workspaceId,
      projectId: input.projectId,
      name: name.slice(0, 200),
      number: (maxNumber ?? 0) + 1,
      startDate,
      endDate,
    })
    .returning({ id: cycles.id });
  return created.id;
}

export async function apiCreateLabel(
  workspaceId: string,
  input: { name?: string; color?: string },
): Promise<string> {
  const name = input.name?.trim();
  if (!name) throw new Error("`name` is required.");
  const [created] = await db
    .insert(labels)
    .values({
      workspaceId,
      name: name.slice(0, 60),
      color: input.color?.trim() || "#a1a1aa",
    })
    .returning({ id: labels.id });
  return created.id;
}
