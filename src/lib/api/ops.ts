import "server-only";

import { and, desc, eq, ilike, inArray, isNull, max, notInArray, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  activity,
  comments,
  crmAccounts,
  crmContacts,
  cycles,
  deals,
  features,
  issueAssignees,
  issueLabels,
  issues,
  labels,
  milestones,
  pageVersions,
  pages,
  projects,
  tickets,
  users,
  workspaceMembers,
} from "@/db/schema";
import {
  isIssueType,
  isMilestoneStatus,
  isPriority,
  isStatus,
} from "@/lib/constants";
import { ApiInputError, isUniqueViolation } from "@/lib/api/errors";
import { apiInvalidate } from "@/lib/api/invalidate";
import { dispatchWebhook } from "@/lib/api/webhooks";
import { docToText, markdownToDoc } from "@/lib/markdown";
import { shouldSnapshot, VERSION_RETENTION } from "@/lib/page-collab";

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

/**
 * Set the whole assignee set. `issues.assigneeId` stays the primary (it drives
 * board avatars, sorting and grouping) and the join table holds everyone —
 * the issue detail reads assignees from the join table, so both must move
 * together.
 */
async function setAssignees(
  workspaceId: string,
  issueId: string,
  userIds: string[],
): Promise<void> {
  const ids = [...new Set(userIds.filter(Boolean))];
  for (const id of ids) await assertRef(workspaceId, "user", id);

  await db.delete(issueAssignees).where(eq(issueAssignees.issueId, issueId));
  if (ids.length > 0)
    await db
      .insert(issueAssignees)
      .values(ids.map((userId) => ({ issueId, userId })))
      .onConflictDoNothing();
  await db
    .update(issues)
    .set({ assigneeId: ids[0] ?? null, updatedAt: new Date() })
    .where(and(eq(issues.workspaceId, workspaceId), eq(issues.id, issueId)));
}

/**
 * Resolve who to assign to. `assigneeId` wins; otherwise match `assigneeEmail`.
 *
 * Integrations know people by address, not by our uuids, so requiring
 * `assigneeId` meant every API-filed issue landed unassigned.
 *
 * Joined through `workspaceMembers`, NEVER the global `users` table alone:
 * `users.email` is globally unique, so matching users directly would let a key
 * for workspace A assign an issue to a member of workspace B.
 *
 * An unrecognised address resolves to `null` (unassigned) rather than throwing
 * — the caller has usually just had a human approve this item, and filing it
 * must not fail because our directory is missing someone.
 */
export async function resolveMemberIdByEmail(
  workspaceId: string,
  email: string | null | undefined,
): Promise<string | null> {
  const wanted = email?.trim().toLowerCase();
  if (!wanted) return null;
  const [row] = await db
    .select({ id: users.id })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(sql`lower(${users.email})`, wanted),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

export async function resolveAssigneeId(
  workspaceId: string,
  input: { assigneeId?: string | null; assigneeEmail?: string | null },
): Promise<string | null> {
  if (input.assigneeId) return input.assigneeId;
  return resolveMemberIdByEmail(workspaceId, input.assigneeEmail);
}

/** The issue already filed for this (workspace, source, external id), if any. */
async function findByExternalRef(
  workspaceId: string,
  source: string,
  externalId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: issues.id })
    .from(issues)
    .where(
      and(
        eq(issues.workspaceId, workspaceId),
        eq(issues.externalSource, source),
        eq(issues.externalId, externalId),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

/** Attempts for the number-allocation race in `apiCreateIssue`. */
const NUMBER_ALLOCATION_ATTEMPTS = 4;

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
    assigneeEmail?: string | null;
    creatorEmail?: string | null;
    assigneeIds?: string[];
    cycleId?: string | null;
    milestoneId?: string | null;
    featureId?: string | null;
    parentId?: string | null;
    labelIds?: string[];
    estimate?: number | null;
    startDate?: string | null;
    dueDate?: string | null;
    description?: string;
    externalSource?: string | null;
    externalId?: string | null;
    externalUrl?: string | null;
  },
): Promise<{ id: string; created: boolean }> {
  const title = input.title?.trim();
  if (!title) throw new ApiInputError("`title` is required.");

  // Idempotency. A caller that retries a create after a timed-out but
  // successful first attempt must not end up with two issues for one record,
  // so an existing issue with the same (workspace, source, id) wins.
  const source = input.externalSource?.trim() || null;
  const externalId = input.externalId?.trim() || null;
  if (source && externalId) {
    const existing = await findByExternalRef(workspaceId, source, externalId);
    if (existing) return { id: existing, created: false };
  }
  if (input.type && !isIssueType(input.type))
    throw new Error(
      "`type` must be one of: engineering, product, research, marketing, sales, ops, legal, finance, people, admin.",
    );

  // Resolve `assigneeEmail` -> id before ref validation, so an address and a
  // uuid take exactly the same downstream path.
  const resolvedAssigneeId = await resolveAssigneeId(workspaceId, input);

  // Who FILED this, as distinct from who has to do it. An integration acts
  // under one API key, so without this every issue it files is authored by the
  // key's own member and the real author is lost — "created by Standup AI" for
  // hundreds of issues raised by different people. `creatorEmail` restores the
  // human. Falls back to the key's member when the address is absent or belongs
  // to nobody here, for the same reason assignee does: the caller has usually
  // just had a human approve this, and filing must not fail over attribution.
  const resolvedCreatorId =
    (await resolveMemberIdByEmail(workspaceId, input.creatorEmail)) ?? userId;

  const refs = {
    projectId: toRef(input.projectId),
    cycleId: toRef(input.cycleId),
    milestoneId: toRef(input.milestoneId),
    featureId: toRef(input.featureId),
    parentId: toRef(input.parentId),
    assigneeId: toRef(resolvedAssigneeId),
  };

  await Promise.all([
    assertRef(workspaceId, "project", refs.projectId),
    assertRef(workspaceId, "cycle", refs.cycleId),
    assertRef(workspaceId, "milestone", refs.milestoneId),
    assertRef(workspaceId, "feature", refs.featureId),
    assertRef(workspaceId, "issue", refs.parentId),
    assertRef(workspaceId, "user", refs.assigneeId),
  ]);

  const values = {
    workspaceId,
    projectId: refs.projectId,
    cycleId: refs.cycleId,
    milestoneId: refs.milestoneId,
    featureId: refs.featureId,
    parentId: refs.parentId,
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
    creatorId: resolvedCreatorId,
    sortKey: `a${Date.now()}`,
    externalSource: source,
    externalId,
    externalUrl: input.externalUrl?.trim() || null,
  };

  // `number` is allocated read-then-write against a unique index on
  // (project_id, number), so two concurrent creates in the same project read
  // the same MAX and the second insert violates the index. That is not
  // hypothetical — an integration filing a batch of approved items fires these
  // concurrently. Re-read and retry on the unique violation; the window is a
  // single round-trip so this converges immediately in practice.
  //
  // A unique violation can also come from the (workspace, source, id) index
  // when two identical creates race the pre-check above. That one must NOT
  // retry — the winner's row is the answer.
  let created: typeof issues.$inferSelect | undefined;
  for (let attempt = 0; attempt < NUMBER_ALLOCATION_ATTEMPTS; attempt++) {
    const [{ value: maxNumber }] = await db
      .select({ value: max(issues.number) })
      .from(issues)
      .where(
        refs.projectId
          ? and(eq(issues.workspaceId, workspaceId), eq(issues.projectId, refs.projectId))
          : eq(issues.workspaceId, workspaceId),
      );
    try {
      [created] = await db
        .insert(issues)
        .values({ ...values, number: (maxNumber ?? 0) + 1 })
        .returning();
      break;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      if (source && externalId) {
        const winner = await findByExternalRef(workspaceId, source, externalId);
        if (winner) return { id: winner, created: false };
      }
      if (attempt === NUMBER_ALLOCATION_ATTEMPTS - 1) throw err;
    }
  }
  if (!created) throw new Error("Issue insert produced no row.");

  // `assigneeIds` wins when both are sent; `assigneeId` stays for single-owner
  // callers and becomes the primary.
  const initialAssignees = input.assigneeIds?.length
    ? input.assigneeIds
    : refs.assigneeId
      ? [refs.assigneeId]
      : [];
  if (initialAssignees.length > 0)
    await setAssignees(workspaceId, created.id, initialAssignees);
  if (input.labelIds?.length)
    await setIssueLabels(workspaceId, created.id, input.labelIds);

  await db.insert(activity).values({
    workspaceId,
    issueId: created.id,
    actorId: userId,
    type: "created",
    data: null,
  });

  apiInvalidate(workspaceId, "issues");
  await dispatchWebhook(workspaceId, "issue.created", {
    id: created.id,
    title: created.title,
    status: created.status,
    priority: created.priority,
  });

  return { id: created.id, created: true };
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
  // Same reasoning as create: integrations reassign by address, not by uuid.
  // Only consulted when `assigneeId` was not sent, so an explicit id still wins
  // and an explicit `assigneeId: null` still unassigns.
  else if ("assigneeEmail" in patch)
    values.assigneeId = await resolveAssigneeId(workspaceId, {
      assigneeEmail: patch.assigneeEmail as string | null,
    });
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

  if (Array.isArray(patch.assigneeIds))
    await setAssignees(workspaceId, id, patch.assigneeIds as string[]);
  else if ("assigneeId" in patch) {
    const primary = toRef(patch.assigneeId);
    await setAssignees(workspaceId, id, primary ? [primary] : []);
  }
  if (Array.isArray(patch.labelIds))
    await setIssueLabels(workspaceId, id, patch.labelIds as string[]);

  apiInvalidate(workspaceId, "issues");
  await dispatchWebhook(workspaceId, "issue.updated", { id, ...patch });
  return true;
}

export async function apiDeleteIssue(workspaceId: string, id: string): Promise<boolean> {
  const res = await db
    .delete(issues)
    .where(and(eq(issues.workspaceId, workspaceId), eq(issues.id, id)))
    .returning({ id: issues.id });
  if (res.length > 0) {
    apiInvalidate(workspaceId, "issues");
    await dispatchWebhook(workspaceId, "issue.deleted", { id });
  }
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
  apiInvalidate(workspaceId, "issues");
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
  apiInvalidate(workspaceId, "projects");
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
  apiInvalidate(workspaceId, "pages");
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
  userId: string | null = null,
): Promise<boolean> {
  const now = new Date();
  const values: Record<string, unknown> = { updatedAt: now };
  if (typeof patch.title === "string") values.title = patch.title.trim() || "Untitled";
  if (typeof patch.icon === "string" && patch.icon.trim()) values.icon = patch.icon.trim();
  if (typeof patch.content === "string") {
    const doc = textToDoc(patch.content);
    values.content = doc;
    values.contentText = docToText(doc).slice(0, 20000);

    // Snapshot the pre-update state, throttled the same way the editor does,
    // so an agent's rewrite is recoverable from version history.
    const [current] = await db
      .select({ title: pages.title, content: pages.content })
      .from(pages)
      .where(and(eq(pages.workspaceId, workspaceId), eq(pages.id, id)))
      .limit(1);
    if (current) {
      const [last] = await db
        .select({ createdAt: pageVersions.createdAt })
        .from(pageVersions)
        .where(eq(pageVersions.pageId, id))
        .orderBy(desc(pageVersions.createdAt))
        .limit(1);
      if (shouldSnapshot(last?.createdAt ?? null, now)) {
        await db.insert(pageVersions).values({
          workspaceId,
          pageId: id,
          title: current.title,
          content: current.content,
          authorId: userId,
          cause: "auto",
        });
        const keep = await db
          .select({ id: pageVersions.id })
          .from(pageVersions)
          .where(eq(pageVersions.pageId, id))
          .orderBy(desc(pageVersions.createdAt))
          .limit(VERSION_RETENTION);
        if (keep.length === VERSION_RETENTION)
          await db
            .delete(pageVersions)
            .where(
              and(
                eq(pageVersions.pageId, id),
                notInArray(
                  pageVersions.id,
                  keep.map((k) => k.id),
                ),
              ),
            );
      }
    }
  }

  const res = await db
    .update(pages)
    .set(values)
    .where(
      and(eq(pages.workspaceId, workspaceId), eq(pages.id, id), isNull(pages.deletedAt)),
    )
    .returning({ id: pages.id, title: pages.title });
  if (res.length > 0) {
    apiInvalidate(workspaceId, "pages");
    await dispatchWebhook(workspaceId, "page.updated", { id, title: res[0].title });
  }
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
  apiInvalidate(workspaceId, "pages");
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
  const [
    issueRows,
    pageRows,
    projectRows,
    ticketRows,
    dealRows,
    accountRows,
    contactRows,
    milestoneRows,
    featureRows,
  ] = await Promise.all([
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
    db
      .select({ id: tickets.id, subject: tickets.subject })
      .from(tickets)
      .where(and(eq(tickets.workspaceId, workspaceId), ilike(tickets.subject, term)))
      .limit(10),
    db
      .select({ id: deals.id, name: deals.name })
      .from(deals)
      .where(and(eq(deals.workspaceId, workspaceId), ilike(deals.name, term)))
      .limit(10),
    db
      .select({ id: crmAccounts.id, name: crmAccounts.name })
      .from(crmAccounts)
      .where(
        and(eq(crmAccounts.workspaceId, workspaceId), ilike(crmAccounts.name, term)),
      )
      .limit(10),
    db
      .select({ id: crmContacts.id, name: crmContacts.name })
      .from(crmContacts)
      .where(
        and(
          eq(crmContacts.workspaceId, workspaceId),
          or(ilike(crmContacts.name, term), ilike(crmContacts.email, term)),
        ),
      )
      .limit(10),
    db
      .select({ id: milestones.id, name: milestones.name })
      .from(milestones)
      .where(
        and(eq(milestones.workspaceId, workspaceId), ilike(milestones.name, term)),
      )
      .limit(10),
    db
      .select({ id: features.id, title: features.title })
      .from(features)
      .where(and(eq(features.workspaceId, workspaceId), ilike(features.title, term)))
      .limit(10),
  ]);

  return [
    ...issueRows.map((r) => ({ type: "issue", id: r.id, title: r.title, url: `${base}/issues/${r.id}` })),
    ...pageRows.map((r) => ({ type: "page", id: r.id, title: r.title || "Untitled", url: `${base}/pages/${r.id}` })),
    ...projectRows.map((r) => ({ type: "project", id: r.id, title: r.name, url: `${base}/projects/${r.id}` })),
    ...ticketRows.map((r) => ({ type: "ticket", id: r.id, title: r.subject, url: `${base}/tickets/${r.id}` })),
    ...dealRows.map((r) => ({ type: "deal", id: r.id, title: r.name, url: `${base}/deals/${r.id}` })),
    ...accountRows.map((r) => ({ type: "account", id: r.id, title: r.name, url: `${base}/accounts/${r.id}` })),
    ...contactRows.map((r) => ({ type: "contact", id: r.id, title: r.name, url: `${base}/contacts/${r.id}` })),
    ...milestoneRows.map((r) => ({ type: "milestone", id: r.id, title: r.name, url: `${base}/milestones/${r.id}` })),
    ...featureRows.map((r) => ({ type: "feature", id: r.id, title: r.title, url: `${base}/features/${r.id}` })),
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
  apiInvalidate(workspaceId, "milestones");
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
  apiInvalidate(workspaceId, "features");
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
  apiInvalidate(workspaceId, "cycles");
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
  apiInvalidate(workspaceId, "labels");
  return created.id;
}
