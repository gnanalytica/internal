import "server-only";

import { and, asc, desc, eq, exists, ilike, inArray, notInArray, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { issueAssignees, issues, labels, projects, users, workspaceMembers } from "@/db/schema";
import { canSeeProject, type ApiScope } from "@/lib/api/scope-rules";
import { recordsOf, type ActivityEntry, type ProspectRecord } from "@/lib/prospects/parse";
import { loadWorkbook } from "@/lib/prospects/read";
import { PROSPECT_KINDS, PROSPECTS_PRODUCT_KEY, type ProspectKind } from "@/lib/prospects/schema";
import { parseIssueKey, rankByName, type IssueKey } from "./parse";
import type { Choice, ProspectView, TaskRow } from "./views";

/**
 * The reads behind `/internal`, its modals and link previews. Each applies the
 * caller's scope the way the API does for a member's key: nothing inside a
 * confidential project is shown to someone who couldn't open it in the web.
 */

const assignee = alias(users, "assignee");

type VisibleTask = TaskRow & { projectId: string | null };

function selectTasks(where: SQL | undefined, limit: number, order: SQL[] = [desc(issues.updatedAt)]) {
  return db
    .select({
      id: issues.id,
      number: issues.number,
      title: issues.title,
      status: issues.status,
      priority: issues.priority,
      projectId: issues.projectId,
      projectKey: projects.key,
      projectName: projects.name,
      assigneeName: assignee.name,
    })
    .from(issues)
    .leftJoin(projects, eq(projects.id, issues.projectId))
    .leftJoin(assignee, eq(assignee.id, issues.assigneeId))
    .where(where)
    .orderBy(...order)
    .limit(limit);
}

const visible = (scope: ApiScope, rows: VisibleTask[]) => rows.filter((r) => canSeeProject(scope, r.projectId));

/** A task by its key (VAL-12), in this workspace. */
export async function findIssueByKey(workspaceId: string, key: IssueKey): Promise<{ id: string; projectId: string | null } | null> {
  const [r] = await db
    .select({ id: issues.id, projectId: issues.projectId })
    .from(issues)
    .innerJoin(projects, eq(projects.id, issues.projectId))
    .where(and(eq(issues.workspaceId, workspaceId), eq(projects.key, key.projectKey), eq(issues.number, key.number)))
    .limit(1);
  return r ?? null;
}

/** Tasks whose title holds the text (or whose key it is), newest activity first. */
export async function searchTasks(workspaceId: string, query: string, scope: ApiScope, limit = 8): Promise<TaskRow[]> {
  const q = query.trim().slice(0, 200);
  if (!q) return [];
  const key = parseIssueKey(q);
  const term = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const match = key
    ? or(ilike(issues.title, term), and(eq(projects.key, key.projectKey), eq(issues.number, key.number)))
    : ilike(issues.title, term);
  // Over-fetch a little: rows in projects the caller can't see are dropped after.
  const rows = await selectTasks(and(eq(issues.workspaceId, workspaceId), match), limit * 3);
  return visible(scope, rows).slice(0, limit);
}

/** The caller's open tasks — primary assignee or co-assignee — most recently touched first. */
export async function myOpenTasks(workspaceId: string, userId: string, scope: ApiScope): Promise<TaskRow[]> {
  const coAssigned = exists(
    db
      .select({ one: issueAssignees.issueId })
      .from(issueAssignees)
      .where(and(eq(issueAssignees.issueId, issues.id), eq(issueAssignees.userId, userId))),
  );
  const rows = await selectTasks(
    and(
      eq(issues.workspaceId, workspaceId),
      notInArray(issues.status, ["done", "canceled"]),
      or(eq(issues.assigneeId, userId), coAssigned),
    ),
    200,
  );
  return visible(scope, rows);
}

/** One task's row, for the comment modal's heading. */
export async function taskRow(workspaceId: string, id: string): Promise<VisibleTask | null> {
  const [r] = await selectTasks(and(eq(issues.workspaceId, workspaceId), eq(issues.id, id)), 1);
  return r ?? null;
}

/** Whether a project is confidential (admins only), for previews and cards. */
export async function projectIsConfidential(projectId: string | null | undefined): Promise<boolean> {
  if (!projectId) return false;
  const [p] = await db.select({ c: projects.confidential }).from(projects).where(eq(projects.id, projectId)).limit(1);
  return p?.c ?? false;
}

/** What the new-task modal offers: projects the caller can see, members, labels — and Valytica, the default. */
export async function newTaskChoices(
  workspaceId: string,
  scope: ApiScope,
): Promise<{ projects: Choice[]; members: Choice[]; labels: Choice[]; defaultProjectId: string | null }> {
  const [ps, ms, ls] = await Promise.all([
    db
      .select({ id: projects.id, name: projects.name, key: projects.key })
      .from(projects)
      .where(eq(projects.workspaceId, workspaceId))
      .orderBy(asc(projects.name)),
    db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(eq(workspaceMembers.workspaceId, workspaceId))
      .orderBy(asc(users.name)),
    db.select({ id: labels.id, name: labels.name }).from(labels).where(eq(labels.workspaceId, workspaceId)).orderBy(asc(labels.name)),
  ]);
  const seen = ps.filter((p) => canSeeProject(scope, p.id));
  return {
    projects: seen.map((p) => ({ id: p.id, label: `${p.name} (${p.key})` })),
    members: ms.map((m) => ({ id: m.id, label: m.name || m.email })),
    labels: ls.map((l) => ({ id: l.id, label: l.name })),
    defaultProjectId: seen.find((p) => p.key === PROSPECTS_PRODUCT_KEY)?.id ?? null,
  };
}

/** Labels that belong to this workspace, so a stale modal can't attach someone else's. */
export async function workspaceLabelIds(workspaceId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: labels.id })
    .from(labels)
    .where(and(eq(labels.workspaceId, workspaceId), inArray(labels.id, ids)));
  return rows.map((r) => r.id);
}

/** Who created a task and when it last changed, for the card's subtitle. */
export async function issueMeta(id: string): Promise<{ creatorName: string | null; updatedAt: Date } | null> {
  const [r] = await db
    .select({ creatorName: users.name, updatedAt: issues.updatedAt })
    .from(issues)
    .leftJoin(users, eq(users.id, issues.creatorId))
    .where(eq(issues.id, id))
    .limit(1);
  return r ?? null;
}

/* ---------- prospects (the Google Sheet) ---------- */

function latestTouch(activity: readonly ActivityEntry[], id: string): ProspectView["lastTouch"] {
  let best: ActivityEntry | null = null;
  for (const a of activity) {
    if (a.registrationNo !== id) continue;
    if (!best || (a.date ?? "") > (best.date ?? "") || ((a.date ?? "") === (best.date ?? "") && a.id > best.id)) best = a;
  }
  return best ? { date: best.date, channel: best.channel, outcome: best.outcome, by: best.by, summary: best.summary } : null;
}

function viewOf(r: ProspectRecord, activity: readonly ActivityEntry[]): ProspectView {
  return {
    kind: r.kind,
    id: r.id,
    ref: `${r.kind}:${r.id}`,
    name: r.name || r.id,
    status: r.status,
    city: r.city,
    assigned: r.assigned,
    nextStep: r.nextStep,
    nextStepDate: r.nextStepDate,
    lastContacted: r.lastContacted,
    lastTouch: latestTouch(activity, r.id),
  };
}

/** Prospects whose name (or registration number) matches, best first. */
export async function findProspects(query: string, limit = 5): Promise<ProspectView[]> {
  const wb = await loadWorkbook();
  const all = PROSPECT_KINDS.flatMap((k) => recordsOf(wb, k));
  return rankByName(all, query, limit).map((r) => viewOf(r, wb.activity));
}

/** One prospect by kind and sheet id. */
export async function prospectByRef(kind: ProspectKind, id: string): Promise<ProspectView | null> {
  const wb = await loadWorkbook();
  const r = recordsOf(wb, kind).find((x) => x.id === id);
  return r ? viewOf(r, wb.activity) : null;
}
