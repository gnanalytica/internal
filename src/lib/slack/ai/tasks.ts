import "server-only";

import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, ilike, inArray, isNull, notInArray, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { activity, comments, issueAssignees, issueLabels, issueRelations, issues, labels, projects, slackThreads, users } from "@/db/schema";
import { ApiInputError } from "@/lib/api/errors";
import { apiCreateComment, apiCreateIssue, apiUpdateIssue } from "@/lib/api/ops";
import { canSeeProject, type ApiScope } from "@/lib/api/scope-rules";
import { askKeywords } from "@/lib/ask-keywords";
import { PRIORITY_MAP, STATUS_MAP, type PriorityId, type StatusId } from "@/lib/constants";
import { docToText } from "@/lib/markdown";
import { findMentionedMemberIds } from "@/lib/mentions";
import { audienceFor, notify, subscribe, subscribeMany } from "@/lib/notify";
import { escapeMrkdwn, issueIdentifier, recordMessage } from "../cards";
import { loadSnapshot } from "../records";
import { changeSummary, CONFIRM_TTL_MS, pendingKey, type Change, type PendingAction, type TaskChangePlan } from "./confirm";
import { memberDirectory } from "./context";
import { byUrgency, dayOf, isOpenStatus, OPEN_STATUSES, projectStatus, taskBrief, taskUrl, threadTaskDescription, type TaskRow } from "./format";
import { matchLabels, matchMember, matchProject, parseTaskRef, type Match } from "./refs";
import { fail, ok, type RequestCtx } from "./request";
import type { ToolInput } from "./tools";
import type { ToolResult } from "./loop";

/**
 * The task tools, against the database. Reads apply the caller's scope in SQL
 * (confidential projects never come back), and writes go through the same
 * session-less ops the API and the other Slack handlers use, plus the
 * activity rows, subscriptions and notifications the web writes alongside
 * them — so a change made from Slack looks in the app exactly like one made
 * there.
 */

const assignee = alias(users, "assignee");

const taskColumns = {
  id: issues.id,
  number: issues.number,
  title: issues.title,
  status: issues.status,
  priority: issues.priority,
  dueDate: issues.dueDate,
  updatedAt: issues.updatedAt,
  projectId: issues.projectId,
  assigneeId: issues.assigneeId,
  projectKey: projects.key,
  projectName: projects.name,
  assigneeName: assignee.name,
};

type TaskRecord = TaskRow & { assigneeId: string | null };

function taskQuery(where: SQL | undefined) {
  return db
    .select(taskColumns)
    .from(issues)
    .leftJoin(projects, eq(projects.id, issues.projectId))
    .leftJoin(assignee, eq(assignee.id, issues.assigneeId))
    .where(where);
}

/** Excludes, in SQL, tasks in projects the caller may not see. */
function visibleSql(scope: ApiScope): SQL | undefined {
  const hidden = scope.restricted ? [...scope.hiddenProjectIds] : [];
  return hidden.length ? or(isNull(issues.projectId), notInArray(issues.projectId, hidden)) : undefined;
}

async function visibleProjects(workspaceId: string, scope: ApiScope) {
  const rows = await db
    .select({ id: projects.id, key: projects.key, name: projects.name })
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId))
    .orderBy(asc(projects.name));
  return rows.filter((p) => canSeeProject(scope, p.id));
}

async function resolveProject(ctx: RequestCtx, query: string) {
  return matchProject(await visibleProjects(ctx.workspaceId, ctx.scope), query);
}

async function resolveMember(ctx: RequestCtx, query: string) {
  return matchMember(await memberDirectory(ctx.workspaceId), query, ctx.caller.userId);
}

/** A task the caller may see, from however they referred to it. Hidden tasks are "not found", as on the web. */
export async function findTask(workspaceId: string, scope: ApiScope, raw: string): Promise<Match<TaskRecord>> {
  const ref = parseTaskRef(raw);
  if (!ref) return { ok: false, error: `"${raw}" isn't a task key I recognise. Use the key shown in Internal, like VAL-12, or search first.` };
  const ws = eq(issues.workspaceId, workspaceId);
  const rows =
    ref.kind === "id"
      ? await taskQuery(and(ws, eq(issues.id, ref.id))).limit(1)
      : await taskQuery(
          and(ws, eq(issues.number, ref.number), ref.projectKey ? eq(projects.key, ref.projectKey) : undefined),
        ).limit(5);
  const seen = rows.filter((r) => canSeeProject(scope, r.projectId));
  if (seen.length === 0) return { ok: false, error: `There's no task ${raw}.` };
  if (seen.length > 1)
    return { ok: false, error: `#${seen[0].number} is in several projects: ${seen.map((r) => issueIdentifier(r)).join(", ")}. Which one?` };
  return { ok: true, value: seen[0] };
}

/* ---------- reads ---------- */

export async function searchTasks(ctx: RequestCtx, input: ToolInput<"search_tasks">): Promise<ToolResult> {
  const where: (SQL | undefined)[] = [eq(issues.workspaceId, ctx.workspaceId), visibleSql(ctx.scope)];
  if (input.text) {
    const words = askKeywords(input.text);
    where.push(...(words.length ? words.map((w) => ilike(issues.title, `%${w}%`)) : [ilike(issues.title, `%${input.text}%`)]));
  }
  if (input.project) {
    const p = await resolveProject(ctx, input.project);
    if (!p.ok) return fail(p.error);
    where.push(eq(issues.projectId, p.value.id));
  }
  if (input.status === "open") where.push(inArray(issues.status, [...OPEN_STATUSES]));
  else if (input.status) where.push(eq(issues.status, input.status));
  if (input.assignee) {
    if (/^(unassigned|nobody|no one)$/i.test(input.assignee.trim())) where.push(isNull(issues.assigneeId));
    else {
      const m = await resolveMember(ctx, input.assignee);
      if (!m.ok) return fail(m.error);
      where.push(
        or(
          eq(issues.assigneeId, m.value.id),
          inArray(issues.id, db.select({ id: issueAssignees.issueId }).from(issueAssignees).where(eq(issueAssignees.userId, m.value.id))),
        ),
      );
    }
  }
  const limit = input.limit ?? 10;
  const rows = await taskQuery(and(...where)).orderBy(desc(issues.updatedAt)).limit(limit + 1);
  return ok({
    tasks: rows.slice(0, limit).map((r) => taskBrief(r, ctx.appUrl, ctx.today)),
    ...(rows.length > limit ? { more: true } : {}),
  });
}

export async function getTask(ctx: RequestCtx, input: ToolInput<"get_task">): Promise<ToolResult> {
  const t = await findTask(ctx.workspaceId, ctx.scope, input.task);
  if (!t.ok) return fail(t.error);
  const author = alias(users, "author");
  const [[detail], labelRows, commentRows] = await Promise.all([
    db
      .select({ description: issues.description, creator: users.name, createdAt: issues.createdAt })
      .from(issues)
      .leftJoin(users, eq(users.id, issues.creatorId))
      .where(eq(issues.id, t.value.id))
      .limit(1),
    db.select({ name: labels.name }).from(issueLabels).innerJoin(labels, eq(labels.id, issueLabels.labelId)).where(eq(issueLabels.issueId, t.value.id)),
    db
      .select({ body: comments.body, author: author.name, createdAt: comments.createdAt })
      .from(comments)
      .leftJoin(author, eq(author.id, comments.authorId))
      .where(eq(comments.issueId, t.value.id))
      .orderBy(desc(comments.createdAt))
      .limit(5),
  ]);
  const description = docToText(detail?.description).trim();
  return ok({
    ...taskBrief(t.value, ctx.appUrl, ctx.today),
    created_by: detail?.creator ?? null,
    created: dayOf(detail?.createdAt ?? null),
    labels: labelRows.map((l) => l.name),
    description: description ? description.slice(0, 1500) : null,
    latest_comments: commentRows.reverse().map((c) => ({ by: c.author ?? "Someone", on: dayOf(c.createdAt), text: c.body.slice(0, 500) })),
  });
}

export async function myWork(ctx: RequestCtx): Promise<{ tasks: ReturnType<typeof taskBrief>[] }> {
  const me = ctx.caller.userId!;
  const rows = await taskQuery(
    and(
      eq(issues.workspaceId, ctx.workspaceId),
      visibleSql(ctx.scope),
      inArray(issues.status, [...OPEN_STATUSES]),
      or(eq(issues.assigneeId, me), inArray(issues.id, db.select({ id: issueAssignees.issueId }).from(issueAssignees).where(eq(issueAssignees.userId, me)))),
    ),
  ).limit(100);
  return { tasks: rows.sort(byUrgency).slice(0, 15).map((r) => taskBrief(r, ctx.appUrl, ctx.today)) };
}

export async function projectStatusTool(ctx: RequestCtx, input: ToolInput<"project_status">): Promise<ToolResult> {
  const p = await resolveProject(ctx, input.project);
  if (!p.ok) return fail(p.error);
  const rows = await taskQuery(and(eq(issues.workspaceId, ctx.workspaceId), eq(issues.projectId, p.value.id))).limit(2000);
  const openIds = rows.filter((r) => isOpenStatus(r.status)).map((r) => r.id);
  const openSet = new Set(openIds);
  const blockers = openIds.length
    ? await db
        .select({ blocker: issueRelations.issueId, blocked: issueRelations.relatedIssueId })
        .from(issueRelations)
        .where(and(eq(issueRelations.workspaceId, ctx.workspaceId), eq(issueRelations.type, "blocks"), inArray(issueRelations.relatedIssueId, openIds)))
    : [];
  const blocked = new Set(blockers.filter((b) => openSet.has(b.blocker)).map((b) => b.blocked));
  return ok({
    project: { name: p.value.name, key: p.value.key, url: `${ctx.appUrl}/projects/${p.value.id}` },
    ...projectStatus(rows, blocked, ctx.appUrl, ctx.today),
  });
}

/* ---------- writes ---------- */

/** A thrown ApiInputError is the caller's to fix: it goes back to the model as the reason. */
async function guarded(run: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof ApiInputError) return fail(err.message);
    throw err;
  }
}

/** The card for a task, queued to post under the reply. */
async function queueTaskCard(ctx: RequestCtx, issueId: string, headline: string): Promise<void> {
  const snap = await loadSnapshot(ctx.workspaceId, "issue", issueId);
  if (snap) ctx.outbox.cards.push(recordMessage(snap, headline, ctx.appUrl));
}

type NewTask = {
  title: string;
  description?: string;
  project?: string;
  assignee?: string;
  priority?: string;
  status?: string;
  labels?: string[];
  due_date?: string;
};

/** Resolve names to ids and create the task as the caller. */
async function createAsCaller(ctx: RequestCtx, input: NewTask): Promise<Match<{ id: string; assigneeId: string | null }>> {
  const me = ctx.caller.userId!;
  let projectId: string | null = null;
  if (input.project) {
    const p = await resolveProject(ctx, input.project);
    if (!p.ok) return p;
    projectId = p.value.id;
  }
  let assigneeId: string | null = null;
  if (input.assignee && !/^(unassigned|nobody|no one)$/i.test(input.assignee.trim())) {
    const m = await resolveMember(ctx, input.assignee);
    if (!m.ok) return m;
    assigneeId = m.value.id;
  }
  let labelIds: string[] = [];
  if (input.labels?.length) {
    const all = await db.select({ id: labels.id, name: labels.name }).from(labels).where(eq(labels.workspaceId, ctx.workspaceId));
    const l = matchLabels(all, input.labels);
    if (!l.ok) return l;
    labelIds = l.value;
  }
  const { id } = await apiCreateIssue(ctx.workspaceId, me, {
    title: input.title,
    description: input.description,
    projectId,
    assigneeId,
    priority: input.priority,
    status: input.status,
    labelIds,
    dueDate: input.due_date ?? null,
  });
  // As the web does: you hear about what you created, and about what you were handed.
  await subscribe(ctx.workspaceId, me, "issue", id);
  if (assigneeId && assigneeId !== me) await subscribe(ctx.workspaceId, assigneeId, "issue", id);
  return { ok: true, value: { id, assigneeId } };
}

async function createdResult(ctx: RequestCtx, id: string): Promise<ToolResult> {
  const t = await findTask(ctx.workspaceId, ctx.scope, id);
  await queueTaskCard(ctx, id, `*${escapeMrkdwn(ctx.caller.name ?? "Someone")}* created this from Slack`);
  return ok({ created: t.ok ? taskBrief(t.value, ctx.appUrl, ctx.today) : { url: taskUrl(ctx.appUrl, id) }, card: "posted under your reply" });
}

export async function createTask(ctx: RequestCtx, input: ToolInput<"create_task">): Promise<ToolResult> {
  return guarded(async () => {
    const r = await createAsCaller(ctx, input);
    if (!r.ok) return fail(r.error);
    return createdResult(ctx, r.value.id);
  });
}

export async function commentOnTask(ctx: RequestCtx, input: ToolInput<"comment_on_task">): Promise<ToolResult> {
  return guarded(async () => {
    const t = await findTask(ctx.workspaceId, ctx.scope, input.task);
    if (!t.ok) return fail(t.error);
    const me = ctx.caller.userId!;
    await apiCreateComment(ctx.workspaceId, me, t.value.id, input.body);
    // The web's side effects for a comment: the author and anyone @mentioned
    // follow the task; mentioned people hear about it first, everyone else after.
    const target = { kind: "issue" as const, id: t.value.id };
    const mentioned = findMentionedMemberIds(input.body, await memberDirectory(ctx.workspaceId)).filter((u) => u !== me);
    await subscribe(ctx.workspaceId, me, "issue", t.value.id);
    await subscribeMany(ctx.workspaceId, mentioned, "issue", t.value.id);
    const body = input.body.slice(0, 140);
    await notify({ workspaceId: ctx.workspaceId, actorId: me, type: "mentioned", target, userIds: mentioned, title: `${ctx.caller.name} mentioned you on ${t.value.title}`, body });
    const others = (await audienceFor(ctx.workspaceId, target, me)).filter((u) => !mentioned.includes(u));
    await notify({ workspaceId: ctx.workspaceId, actorId: me, type: "commented", target, userIds: others, title: `${ctx.caller.name} commented on ${t.value.title}`, body });
    await queueTaskCard(ctx, t.value.id, `*${escapeMrkdwn(ctx.caller.name ?? "Someone")}* commented from Slack`);
    return ok({ commented_on: taskBrief(t.value, ctx.appUrl, ctx.today), card: "posted under your reply" });
  });
}

export async function threadToTask(ctx: RequestCtx, input: ToolInput<"summarize_thread_to_task">): Promise<ToolResult> {
  const thread = ctx.slackThread;
  if (!thread) return fail("This isn't a channel thread, so there's nothing to link. Use create_task instead.");
  return guarded(async () => {
    const permalink = await thread.permalink().catch(() => null);
    const description = threadTaskDescription({
      summary: input.summary,
      keyPoints: input.key_points,
      permalink,
      where: ctx.where,
      by: ctx.caller.name ?? "someone",
    });
    const r = await createAsCaller(ctx, { ...input, description });
    if (!r.ok) return fail(r.error);
    // Link the thread to the task, so later events for it reply here (as a
    // notification card's thread would) rather than opening a new card.
    await db
      .insert(slackThreads)
      .values({ workspaceId: ctx.workspaceId, recordType: "issue", recordId: r.value.id, slackChannelId: thread.channel, slackThreadTs: thread.ts })
      .onConflictDoNothing({ target: [slackThreads.recordType, slackThreads.recordId, slackThreads.slackChannelId] });
    return createdResult(ctx, r.value.id);
  });
}

/* ---------- update_task: planned now, applied on Confirm ---------- */

const statusLabel = (s: string) => STATUS_MAP[s as StatusId]?.label ?? s;
const priorityLabel = (p: string) => PRIORITY_MAP[p as PriorityId]?.label ?? p;

/**
 * Work out exactly what the change would be — ids resolved, no-ops dropped —
 * and store it for the Confirm button. Nothing is written to the task.
 */
export async function planTaskUpdate(
  ctx: RequestCtx,
  input: ToolInput<"update_task">,
  store: { set(key: string, value: unknown, ttlMs?: number): Promise<void> },
): Promise<ToolResult> {
  const t = await findTask(ctx.workspaceId, ctx.scope, input.task);
  if (!t.ok) return fail(t.error);
  const task = t.value;
  const patch: TaskChangePlan["patch"] = {};
  const changes: Change[] = [];

  if (input.status && input.status !== task.status) {
    patch.status = input.status;
    changes.push({ field: "Status", from: statusLabel(task.status), to: statusLabel(input.status) });
  }
  if (input.priority && input.priority !== task.priority) {
    patch.priority = input.priority;
    changes.push({ field: "Priority", from: priorityLabel(task.priority), to: priorityLabel(input.priority) });
  }
  if (input.title && input.title !== task.title) {
    patch.title = input.title;
    changes.push({ field: "Title", from: task.title, to: input.title });
  }
  if (input.assignee) {
    let to: { id: string | null; name: string };
    if (/^(unassigned|nobody|no one|none)$/i.test(input.assignee.trim())) to = { id: null, name: "Unassigned" };
    else {
      const m = await resolveMember(ctx, input.assignee);
      if (!m.ok) return fail(m.error);
      to = { id: m.value.id, name: m.value.name };
    }
    if (to.id !== task.assigneeId) {
      patch.assigneeId = to.id;
      changes.push({ field: "Assignee", from: task.assigneeName ?? "Unassigned", to: to.name });
    }
  }
  if (input.due_date) {
    const want = input.due_date === "none" ? null : input.due_date;
    if (want !== dayOf(task.dueDate)) {
      patch.dueDate = want;
      changes.push({ field: "Due", from: dayOf(task.dueDate) ?? "none", to: want ?? "none" });
    }
  }
  if (changes.length === 0) return ok({ unchanged: taskBrief(task, ctx.appUrl, ctx.today), note: "It already looks like that; nothing to change." });

  const label = `${issueIdentifier(task)} · ${task.title}`;
  const nonce = randomUUID();
  const pending: PendingAction = {
    kind: "update_task",
    workspaceId: ctx.workspaceId,
    slackUserId: ctx.slackUserId,
    appUserId: ctx.caller.userId!,
    threadId: ctx.threadId,
    summary: changeSummary(label, changes),
    createdAt: Date.now(),
    plan: { issueId: task.id, label, patch, before: { status: task.status, assigneeId: task.assigneeId } },
  };
  await store.set(pendingKey(nonce), pending, CONFIRM_TTL_MS);
  ctx.outbox.confirmations.push({ nonce, summary: pending.summary });
  return { content: JSON.stringify({ task: taskBrief(task, ctx.appUrl, ctx.today), proposed: changes, status: "awaiting confirmation" }) };
}

/**
 * Run a confirmed task change as the member who confirmed it. Logged to the
 * activity timeline before the write (the Slack announcement reads it to say
 * who did it), then the same notifications the web sends.
 */
export async function applyTaskUpdate(
  plan: TaskChangePlan,
  workspaceId: string,
  me: { id: string; name: string },
  scope: ApiScope,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = await findTask(workspaceId, scope, plan.issueId);
  if (!t.ok) return { ok: false, error: "That task no longer exists, or you can't see it." };
  const { patch } = plan;
  const acts: { type: string; data: { from: string | null; to: string | null } }[] = [];
  if (patch.status !== undefined && patch.status !== t.value.status) acts.push({ type: "status", data: { from: t.value.status, to: patch.status } });
  if (patch.priority !== undefined && patch.priority !== t.value.priority) acts.push({ type: "priority", data: { from: t.value.priority, to: patch.priority } });
  if (patch.assigneeId !== undefined && patch.assigneeId !== t.value.assigneeId)
    acts.push({ type: "assignee", data: { from: t.value.assigneeId, to: patch.assigneeId } });
  if (acts.length)
    await db.insert(activity).values(acts.map((a) => ({ workspaceId, issueId: plan.issueId, actorId: me.id, type: a.type, data: a.data })));

  try {
    const done = await apiUpdateIssue(workspaceId, plan.issueId, patch);
    if (!done) return { ok: false, error: "That task no longer exists." };
  } catch (err) {
    if (err instanceof ApiInputError) return { ok: false, error: err.message };
    throw err;
  }

  const target = { kind: "issue" as const, id: plan.issueId };
  const title = patch.title ?? t.value.title;
  if (patch.assigneeId && patch.assigneeId !== t.value.assigneeId) {
    await subscribe(workspaceId, patch.assigneeId, "issue", plan.issueId);
    await notify({ workspaceId, actorId: me.id, type: "assigned", target, userIds: [patch.assigneeId], title: `${me.name} assigned you an issue`, body: title });
  }
  if (patch.status && patch.status !== t.value.status) {
    await notify({
      workspaceId,
      actorId: me.id,
      type: "status",
      target,
      userIds: await audienceFor(workspaceId, target, me.id),
      title: `${me.name} moved ${title} to ${statusLabel(patch.status)}`,
    });
  }
  return { ok: true };
}
