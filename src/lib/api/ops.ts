import "server-only";

import { and, desc, eq, ilike, max, or } from "drizzle-orm";

import { db } from "@/db";
import {
  activity,
  comments,
  issues,
  pages,
  projects,
} from "@/db/schema";
import { isPriority, isStatus } from "@/lib/constants";
import { dispatchWebhook } from "@/lib/api/webhooks";

function textToDoc(text: string): unknown {
  const clean = (text ?? "").trim();
  if (!clean) return null;
  return {
    type: "doc",
    content: clean.split(/\n{2,}/).map((para) => ({
      type: "paragraph",
      content: [{ type: "text", text: para.trim() }],
    })),
  };
}

export async function apiCreateIssue(
  workspaceId: string,
  userId: string | null,
  input: {
    title: string;
    projectId?: string | null;
    status?: string;
    priority?: string;
    assigneeId?: string | null;
    estimate?: number | null;
    dueDate?: string | null;
    description?: string;
  },
): Promise<string> {
  const title = input.title?.trim();
  if (!title) throw new Error("`title` is required.");

  const [{ value: maxNumber }] = await db
    .select({ value: max(issues.number) })
    .from(issues)
    .where(
      input.projectId
        ? and(eq(issues.workspaceId, workspaceId), eq(issues.projectId, input.projectId))
        : eq(issues.workspaceId, workspaceId),
    );

  const [created] = await db
    .insert(issues)
    .values({
      workspaceId,
      projectId: input.projectId ?? null,
      number: (maxNumber ?? 0) + 1,
      title: title.slice(0, 500),
      status: input.status && isStatus(input.status) ? input.status : "backlog",
      priority: input.priority && isPriority(input.priority) ? input.priority : "none",
      assigneeId: input.assigneeId ?? null,
      estimate: input.estimate ?? null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      description: input.description ? textToDoc(input.description) : null,
      creatorId: userId,
      sortKey: `a${Date.now()}`,
    })
    .returning();

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
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof patch.title === "string") values.title = patch.title.trim() || "Untitled";
  if (typeof patch.status === "string" && isStatus(patch.status)) values.status = patch.status;
  if (typeof patch.priority === "string" && isPriority(patch.priority))
    values.priority = patch.priority;
  if ("assigneeId" in patch) values.assigneeId = patch.assigneeId ?? null;
  if ("projectId" in patch) values.projectId = patch.projectId ?? null;
  if ("cycleId" in patch) values.cycleId = patch.cycleId ?? null;
  if ("estimate" in patch) values.estimate = patch.estimate ?? null;
  if ("dueDate" in patch) values.dueDate = patch.dueDate ? new Date(patch.dueDate as string) : null;
  if (typeof patch.description === "string") values.description = textToDoc(patch.description);

  const res = await db
    .update(issues)
    .set(values)
    .where(and(eq(issues.workspaceId, workspaceId), eq(issues.id, id)))
    .returning({ id: issues.id });
  if (res.length > 0) await dispatchWebhook(workspaceId, "issue.updated", { id, ...patch });
  return res.length > 0;
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
  input: { title: string; content?: string },
): Promise<string> {
  const [created] = await db
    .insert(pages)
    .values({
      workspaceId,
      title: input.title?.trim() || "Untitled",
      content: input.content ? textToDoc(input.content) : null,
      contentText: input.content ?? "",
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
