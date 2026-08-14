"use server";

import { and, asc, desc, eq, gt, gte, ilike, inArray, isNull, lt, max, notInArray, or } from "drizzle-orm";
import { del, put } from "@vercel/blob";
import { refresh, updateTag } from "next/cache";
import { cookies } from "next/headers";

import { db } from "@/db";
import {
  activity,
  apiKeys,
  attachments,
  campaigns,
  commentReactions,
  comments,
  contentItems,
  crmAccounts,
  crmActivities,
  crmContacts,
  cycles,
  databaseFields,
  databaseRows,
  databases,
  deals,
  expenses,
  favorites,
  features,
  feedback,
  invoices,
  issueAssignees,
  issueLabels,
  labels,
  issuePageLinks,
  issueRelations,
  issues,
  metricPoints,
  metrics,
  milestones,
  orgRoles,
  notifications,
  pageComments,
  pageCommentReactions,
  pagePresence,
  pageVersions,
  projectStatusUpdates,
  references,
  savedViews,
  pages,
  projects,
  ticketComments,
  tickets,
  users,
  webhooks,
  workspaceMembers,
  workspaces,
} from "@/db/schema";
import {
  getCurrentUser,
  getMembers,
  getMyRole,
  getWorkspace,
  pickColor,
} from "@/lib/data";
import {
  isIssueType,
  isMilestoneStatus,
  isPriority,
  isStatus,
  STATUS_MAP,
  type StatusId,
} from "@/lib/constants";
import {
  ceremonyTasksFor,
  isCadenceEmpty,
  normalizeCadence,
  type CycleCadence,
} from "@/lib/cycle-cadence";
import { callClaude, isAiConfigured } from "@/lib/ai";
import { extractJsonArray, normalizeProposedIssue } from "@/lib/ai-parse";
import { generateApiKey } from "@/lib/api/keys";
import {
  audienceFor,
  notify,
  subscribe,
  subscribeMany,
  subscriberIds,
  unsubscribe,
  SUBSCRIBABLE,
} from "@/lib/notify";
import {
  issueAttachmentsTag,
  wsTags,
  type CacheEntity,
} from "@/lib/cache-tags";
import {
  WEBHOOK_EVENTS,
  dispatchWebhook,
  newWebhookSecret,
} from "@/lib/api/webhooks";
import { docToText } from "@/lib/markdown";
import { findMentionedMemberIds } from "@/lib/mentions";
import {
  PRESENCE_STALE_MS,
  VERSION_RETENTION,
  presenceColor,
  shouldSnapshot,
} from "@/lib/page-collab";
import type { PresenceUser } from "@/lib/types";
import { SELECT_COLORS } from "@/lib/types";
import { isRelationType } from "@/lib/issue-relations";
import { extractReferences } from "@/lib/references";
import { snippetAround } from "@/lib/snippet";

/**
 * Expire the cached reads a mutation invalidates, then re-render the current
 * route.
 *
 * `updateTag` is the read-your-own-writes form: the next read waits for fresh
 * data rather than serving the stale entry. `refresh()` is separate and still
 * needed — it refreshes the client router, which is what surfaces the reads we
 * deliberately never cache (favourites, notifications, anything per-user).
 */
function invalidate(workspaceId: string, ...entities: CacheEntity[]): void {
  for (const tag of wsTags(workspaceId, ...entities)) updateTag(tag);
  refresh();
}

/** Rewrite the reference graph for a body (issue/page) from its document JSON. */
async function syncReferences(
  workspaceId: string,
  sourceType: "issue" | "page",
  sourceId: string,
  doc: unknown,
) {
  const refs = extractReferences(doc).filter((r) => r.targetId !== sourceId);
  await db
    .delete(references)
    .where(
      and(
        eq(references.sourceType, sourceType),
        eq(references.sourceId, sourceId),
      ),
    );
  if (refs.length) {
    await db
      .insert(references)
      .values(
        refs.map((r) => ({
          workspaceId,
          sourceType,
          sourceId,
          targetType: r.targetType,
          targetId: r.targetId,
        })),
      )
      .onConflictDoNothing();
  }
}
import { isBlobConfigured, MAX_ATTACHMENT_BYTES } from "@/lib/blob";
import { notifySlack } from "@/lib/slack";
import { createGithubIssue, verifyGithubRepo } from "@/lib/github";

// ---- Slack ----

export async function setSlackWebhook(url: string) {
  const ws = await getWorkspace();
  await requireAdmin(ws.id);
  const clean = url.trim();
  if (clean && !clean.startsWith("https://hooks.slack.com/")) {
    throw new Error("That doesn't look like a Slack Incoming Webhook URL.");
  }
  await db
    .update(workspaces)
    .set({ slackWebhookUrl: clean || null })
    .where(eq(workspaces.id, ws.id));
  refresh();
}

export async function sendTestSlack() {
  const ws = await getWorkspace();
  await requireAdmin(ws.id);
  await notifySlack(ws.id, `:wave: Test from *${ws.name}* — Slack is connected.`);
}

// ---- Workspaces (multi-tenancy) ----

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "workspace";
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Create a new workspace; the creator becomes its admin and it becomes active. */
export async function createWorkspace(input: { name: string }) {
  const me = await getCurrentUser();
  const name = input.name.trim() || "New workspace";
  const [ws] = await db
    .insert(workspaces)
    .values({ name, slug: slugify(name) })
    .returning();
  await db
    .insert(workspaceMembers)
    .values({ workspaceId: ws.id, userId: me.id, role: "admin" });
  await db
    .insert(projects)
    .values({ workspaceId: ws.id, name: "General", key: "GEN", color: "#6366f1" });
  (await cookies()).set("active_ws", ws.id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  invalidate(ws.id, "members", "org", "projects");
  return ws;
}

/** Switch the active workspace (validated against membership). */
export async function setActiveWorkspace(workspaceId: string) {
  const me = await getCurrentUser();
  const [m] = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, me.id),
      ),
    )
    .limit(1);
  if (!m) throw new Error("You are not a member of that workspace.");
  (await cookies()).set("active_ws", workspaceId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  refresh();
}

// ---- Members & access ----

async function requireAdmin(workspaceId: string) {
  const role = await getMyRole(workspaceId);
  if (role !== "admin") throw new Error("Only admins can manage members.");
}

async function ensureNotLastAdmin(workspaceId: string, userId: string) {
  const admins = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.role, "admin"),
      ),
    );
  if (admins.length <= 1 && admins.some((a) => a.userId === userId)) {
    throw new Error("There must be at least one admin.");
  }
}

/** Invite a person by email: pre-creates their user row + membership. */
export async function inviteMember(input: {
  email: string;
  name?: string;
  role?: string;
}) {
  const ws = await getWorkspace();
  await requireAdmin(ws.id);
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Enter a valid email.");

  let [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!u) {
    [u] = await db
      .insert(users)
      .values({
        name: input.name?.trim() || email.split("@")[0],
        email,
        avatarColor: pickColor(email),
      })
      .returning();
  }
  await db
    .insert(workspaceMembers)
    .values({
      workspaceId: ws.id,
      userId: u.id,
      role: input.role === "admin" ? "admin" : "member",
    })
    .onConflictDoNothing();
  // People & HR (the members home) lives at /projects/[PPL]; refresh the shell.
  invalidate(ws.id, "members", "org");
}

export async function setMemberRole(userId: string, role: string) {
  const ws = await getWorkspace();
  await requireAdmin(ws.id);
  const r = role === "admin" ? "admin" : "member";
  if (r === "member") await ensureNotLastAdmin(ws.id, userId);
  await db
    .update(workspaceMembers)
    .set({ role: r })
    .where(
      and(
        eq(workspaceMembers.workspaceId, ws.id),
        eq(workspaceMembers.userId, userId),
      ),
    );
  invalidate(ws.id, "members", "org");
}

/** Update a member's HR/directory profile (title, entity, employment, manager). */
export async function updateMemberProfile(
  userId: string,
  patch: Partial<{
    title: string | null;
    entity: string;
    employment: string;
    startDate: string | null;
    managerId: string | null;
  }>,
) {
  const ws = await getWorkspace();
  await requireAdmin(ws.id);
  const values: Record<string, unknown> = {};
  if (patch.title !== undefined) values.title = patch.title;
  if (patch.entity !== undefined) values.entity = patch.entity;
  if (patch.employment !== undefined) values.employment = patch.employment;
  if (patch.startDate !== undefined)
    values.startDate = patch.startDate ? new Date(patch.startDate) : null;
  if (patch.managerId !== undefined) values.managerId = patch.managerId;
  if (Object.keys(values).length === 0) return;
  await db
    .update(workspaceMembers)
    .set(values)
    .where(and(eq(workspaceMembers.workspaceId, ws.id), eq(workspaceMembers.userId, userId)));
  invalidate(ws.id, "members", "org");
}

export async function removeMember(userId: string) {
  const ws = await getWorkspace();
  await requireAdmin(ws.id);
  const me = await getCurrentUser(ws.id);
  if (userId === me.id) throw new Error("You can't remove yourself.");
  await ensureNotLastAdmin(ws.id, userId);
  // Detach reports first: managerId → users.id only SET NULLs on user delete,
  // not on membership removal, so clear it here to avoid a dangling manager.
  await db
    .update(workspaceMembers)
    .set({ managerId: null })
    .where(
      and(
        eq(workspaceMembers.workspaceId, ws.id),
        eq(workspaceMembers.managerId, userId),
      ),
    );
  await db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, ws.id),
        eq(workspaceMembers.userId, userId),
      ),
    );
  invalidate(ws.id, "members", "org");
}

// ---- Org chart (positions/roles) ----

export async function createOrgRole(input: {
  title: string;
  userId?: string | null;
  parentId?: string | null;
}) {
  const ws = await getWorkspace();
  await requireAdmin(ws.id);
  const title = input.title.trim() || "Untitled role";
  const [created] = await db
    .insert(orgRoles)
    .values({
      workspaceId: ws.id,
      title,
      userId: input.userId ?? null,
      parentId: input.parentId ?? null,
      sortKey: `a${Date.now()}`,
    })
    .returning({ id: orgRoles.id });
  invalidate(ws.id, "org");
  return created;
}

export async function updateOrgRole(
  id: string,
  patch: Partial<{ title: string; userId: string | null; parentId: string | null }>,
) {
  const ws = await getWorkspace();
  await requireAdmin(ws.id);
  // Guard against making a role its own ancestor (would orphan the subtree).
  if (patch.parentId) {
    if (patch.parentId === id) throw new Error("A role can't report to itself.");
    const rows = await db
      .select({ id: orgRoles.id, parentId: orgRoles.parentId })
      .from(orgRoles)
      .where(eq(orgRoles.workspaceId, ws.id));
    const parentOf = new Map(rows.map((r) => [r.id, r.parentId]));
    let cursor: string | null | undefined = patch.parentId;
    while (cursor) {
      if (cursor === id) throw new Error("That would create a reporting loop.");
      cursor = parentOf.get(cursor) ?? null;
    }
  }
  const values: Record<string, unknown> = {};
  if (patch.title !== undefined) values.title = patch.title.trim() || "Untitled role";
  if (patch.userId !== undefined) values.userId = patch.userId;
  if (patch.parentId !== undefined) values.parentId = patch.parentId;
  if (Object.keys(values).length === 0) return;
  await db
    .update(orgRoles)
    .set(values)
    .where(and(eq(orgRoles.id, id), eq(orgRoles.workspaceId, ws.id)));
  invalidate(ws.id, "org");
}

export async function deleteOrgRole(id: string) {
  const ws = await getWorkspace();
  await requireAdmin(ws.id);
  // Reparent the deleted role's children onto its own parent so the subtree
  // stays attached rather than scattering into new roots.
  const [target] = await db
    .select({ parentId: orgRoles.parentId })
    .from(orgRoles)
    .where(and(eq(orgRoles.id, id), eq(orgRoles.workspaceId, ws.id)))
    .limit(1);
  if (!target) return;
  await db
    .update(orgRoles)
    .set({ parentId: target.parentId })
    .where(and(eq(orgRoles.workspaceId, ws.id), eq(orgRoles.parentId, id)));
  await db.delete(orgRoles).where(and(eq(orgRoles.id, id), eq(orgRoles.workspaceId, ws.id)));
  invalidate(ws.id, "org");
}

// ---- Issues ----

export async function createIssue(input: {
  title: string;
  projectId?: string | null;
  status?: string;
  priority?: string;
  type?: string;
  assigneeId?: string | null;
  parentId?: string | null;
  featureId?: string | null;
  milestoneId?: string | null;
  labelIds?: string[];
  startDate?: string | null;
  dueDate?: string | null;
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
      parentId: input.parentId ?? null,
      featureId: input.featureId ?? null,
      milestoneId: input.milestoneId ?? null,
      number: (maxNumber ?? 0) + 1,
      title: input.title.trim() || "Untitled task",
      status: input.status && isStatus(input.status) ? input.status : "backlog",
      priority: input.priority && isPriority(input.priority) ? input.priority : "none",
      type: input.type && isIssueType(input.type) ? input.type : "engineering",
      assigneeId: input.assigneeId ?? null,
      creatorId: me.id,
      sortKey: `a${Date.now()}`,
      startDate: input.startDate ? new Date(input.startDate) : null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
    })
    .returning();

  // You hear about what you created, and about what you were handed.
  await subscribe(ws.id, me.id, "issue", created.id);
  if (input.assigneeId && input.assigneeId !== me.id) {
    await subscribe(ws.id, input.assigneeId, "issue", created.id);
  }

  // Mirror the primary assignee into the assignee set.
  if (input.assigneeId) {
    await db
      .insert(issueAssignees)
      .values({ issueId: created.id, userId: input.assigneeId })
      .onConflictDoNothing();
  }

  if (input.labelIds?.length) {
    await db
      .insert(issueLabels)
      .values(input.labelIds.map((labelId) => ({ issueId: created.id, labelId })))
      .onConflictDoNothing();
  }

  await db.insert(activity).values({
    workspaceId: ws.id,
    issueId: created.id,
    actorId: me.id,
    type: "created",
    data: null,
  });

  await notifySlack(
    ws.id,
    `:memo: *${me.name}* created an issue: *${created.title}*`,
  );
  await dispatchWebhook(ws.id, "issue.created", {
    id: created.id,
    title: created.title,
    status: created.status,
    priority: created.priority,
  });

  invalidate(ws.id, "issues");
  return created;
}

// ---- Comments ----

export async function addComment(issueId: string, body: string) {
  const text = body.trim();
  if (!text) return;
  const ws = await getWorkspace();
  const me = await getCurrentUser();
  await db.insert(comments).values({
    workspaceId: ws.id,
    issueId,
    authorId: me.id,
    body: text,
  });

  // Notify mentioned members, plus the issue's assignee and creator
  // (excluding the comment author). A mention takes precedence over the
  // generic "commented" notice so nobody is notified twice.
  const [issue] = await db
    .select({
      title: issues.title,
      assigneeId: issues.assigneeId,
      creatorId: issues.creatorId,
    })
    .from(issues)
    .where(and(eq(issues.workspaceId, ws.id), eq(issues.id, issueId)))
    .limit(1);
  if (issue) {
    const members = await getMembers(ws.id);
    const target = { kind: "issue" as const, id: issueId };
    const mentioned = findMentionedMemberIds(text, members).filter((uid) => uid !== me.id);

    // Commenting and being mentioned both mean you care about what happens
    // next, so both start a subscription.
    await subscribe(ws.id, me.id, "issue", issueId);
    await subscribeMany(ws.id, mentioned, "issue", issueId);

    // A mention wins over the generic notice so nobody is pinged twice.
    await notify({
      workspaceId: ws.id,
      actorId: me.id,
      type: "mentioned",
      target,
      userIds: mentioned,
      title: `${me.name} mentioned you on ${issue.title}`,
      body: text.slice(0, 140),
    });

    const others = (await audienceFor(ws.id, target, me.id)).filter(
      (uid) => !mentioned.includes(uid),
    );
    await notify({
      workspaceId: ws.id,
      actorId: me.id,
      type: "commented",
      target,
      userIds: others,
      title: `${me.name} commented on ${issue.title}`,
      body: text.slice(0, 140),
    });
  }

  await dispatchWebhook(ws.id, "issue.commented", { issueId, body: text });

  invalidate(ws.id, "issues");
}

const REACTION_EMOJI = new Set(["👍", "❤️", "🎉", "😄", "🚀", "👀", "✅"]);

export async function toggleReaction(commentId: string, emoji: string) {
  if (!REACTION_EMOJI.has(emoji)) throw new Error("Unsupported reaction.");
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);

  // Scope the comment to the workspace and grab its issue for revalidation.
  const [c] = await db
    .select({ issueId: comments.issueId })
    .from(comments)
    .where(and(eq(comments.workspaceId, ws.id), eq(comments.id, commentId)))
    .limit(1);
  if (!c) throw new Error("Comment not found.");

  const [existing] = await db
    .select({ id: commentReactions.id })
    .from(commentReactions)
    .where(
      and(
        eq(commentReactions.commentId, commentId),
        eq(commentReactions.userId, me.id),
        eq(commentReactions.emoji, emoji),
      ),
    )
    .limit(1);

  if (existing) {
    await db.delete(commentReactions).where(eq(commentReactions.id, existing.id));
  } else {
    await db
      .insert(commentReactions)
      .values({ commentId, userId: me.id, emoji })
      .onConflictDoNothing();
  }
  invalidate(ws.id, "issues");
}

export async function deleteComment(id: string) {
  const ws = await getWorkspace();
  await db
    .delete(comments)
    .where(and(eq(comments.workspaceId, ws.id), eq(comments.id, id)));
  invalidate(ws.id, "issues");
}

export async function updateIssue(
  id: string,
  patch: Partial<{
    title: string;
    description: unknown;
    status: string;
    priority: string;
    type: string;
    assigneeId: string | null;
    projectId: string | null;
    cycleId: string | null;
    milestoneId: string | null;
    parentId: string | null;
    startDate: string | null;
    dueDate: string | null;
    estimate: number | null;
    sortKey: string;
  }>,
) {
  const ws = await getWorkspace();
  const me = await getCurrentUser();
  const [before] = await db
    .select()
    .from(issues)
    .where(and(eq(issues.workspaceId, ws.id), eq(issues.id, id)))
    .limit(1);

  const values: Record<string, unknown> = { updatedAt: new Date() };

  if (patch.title !== undefined) values.title = patch.title;
  if (patch.description !== undefined) {
    values.description = patch.description;
    await syncReferences(ws.id, "issue", id, patch.description);
  }
  if (patch.status !== undefined && isStatus(patch.status)) values.status = patch.status;
  if (patch.priority !== undefined && isPriority(patch.priority))
    values.priority = patch.priority;
  if (patch.type !== undefined && isIssueType(patch.type)) values.type = patch.type;
  if (patch.assigneeId !== undefined) values.assigneeId = patch.assigneeId;
  if (patch.projectId !== undefined) values.projectId = patch.projectId;
  if (patch.cycleId !== undefined) values.cycleId = patch.cycleId;
  if (patch.milestoneId !== undefined) values.milestoneId = patch.milestoneId;
  if (patch.parentId !== undefined) values.parentId = patch.parentId;
  if (patch.startDate !== undefined)
    values.startDate = patch.startDate ? new Date(patch.startDate) : null;
  if (patch.dueDate !== undefined)
    values.dueDate = patch.dueDate ? new Date(patch.dueDate) : null;
  if (patch.estimate !== undefined) values.estimate = patch.estimate;
  if (patch.sortKey !== undefined) values.sortKey = patch.sortKey;

  await db
    .update(issues)
    .set(values)
    .where(and(eq(issues.workspaceId, ws.id), eq(issues.id, id)));

  // Log meaningful changes to the activity timeline.
  if (before) {
    const acts: { type: string; data: { from: string | null; to: string | null } }[] = [];
    if (patch.status !== undefined && isStatus(patch.status) && before.status !== patch.status)
      acts.push({ type: "status", data: { from: before.status, to: patch.status } });
    if (patch.priority !== undefined && isPriority(patch.priority) && before.priority !== patch.priority)
      acts.push({ type: "priority", data: { from: before.priority, to: patch.priority } });
    if (patch.assigneeId !== undefined && before.assigneeId !== patch.assigneeId)
      acts.push({ type: "assignee", data: { from: before.assigneeId, to: patch.assigneeId } });
    if (acts.length) {
      await db.insert(activity).values(
        acts.map((a) => ({
          workspaceId: ws.id,
          issueId: id,
          actorId: me.id,
          type: a.type,
          data: a.data,
        })),
      );
    }

    const target = { kind: "issue" as const, id };

    // Notify the new assignee (when it's someone other than the actor).
    if (
      patch.assigneeId !== undefined &&
      patch.assigneeId &&
      patch.assigneeId !== before.assigneeId
    ) {
      // Being handed a task subscribes you to it, whoever did the handing.
      await subscribe(ws.id, patch.assigneeId, "issue", id);
      await notify({
        workspaceId: ws.id,
        actorId: me.id,
        type: "assigned",
        target,
        userIds: [patch.assigneeId],
        title: `${me.name} assigned you an issue`,
        body: patch.title ?? before.title,
      });
    }

    // Status is the change watchers actually care about, and the one that had
    // no notification at all before subscriptions existed.
    if (patch.status !== undefined && patch.status !== before.status) {
      const label = STATUS_MAP[patch.status as StatusId]?.label ?? patch.status;
      await notify({
        workspaceId: ws.id,
        actorId: me.id,
        type: "status",
        target,
        userIds: await audienceFor(ws.id, target, me.id),
        title: `${me.name} moved ${patch.title ?? before.title} to ${label}`,
      });
    }
  }

  const { description: _omitDesc, ...changed } = patch;
  void _omitDesc;
  await dispatchWebhook(ws.id, "issue.updated", { id, ...changed });

  invalidate(ws.id, "issues");
}

export async function deleteIssue(id: string) {
  const ws = await getWorkspace();
  await db.delete(issues).where(and(eq(issues.workspaceId, ws.id), eq(issues.id, id)));
  await dispatchWebhook(ws.id, "issue.deleted", { id });
  invalidate(ws.id, "issues");
}

/** Replace an issue's assignee set; keeps issues.assigneeId as the primary. */
export async function setIssueAssignees(issueId: string, userIds: string[]) {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const ids = [...new Set(userIds)];
  const [before] = await db
    .select({ title: issues.title })
    .from(issues)
    .where(and(eq(issues.workspaceId, ws.id), eq(issues.id, issueId)))
    .limit(1);
  const existing = await db
    .select({ userId: issueAssignees.userId })
    .from(issueAssignees)
    .where(eq(issueAssignees.issueId, issueId));
  const had = new Set(existing.map((e) => e.userId));

  await db.delete(issueAssignees).where(eq(issueAssignees.issueId, issueId));
  if (ids.length) {
    await db.insert(issueAssignees).values(ids.map((userId) => ({ issueId, userId })));
  }
  // Primary assignee = first of the set (drives sort/group/board avatar).
  await db
    .update(issues)
    .set({ assigneeId: ids[0] ?? null, updatedAt: new Date() })
    .where(and(eq(issues.workspaceId, ws.id), eq(issues.id, issueId)));

  // Notify newly added assignees (not the actor), and start them watching.
  const added = ids.filter((uid) => !had.has(uid) && uid !== me.id);
  if (added.length) {
    await subscribeMany(ws.id, added, "issue", issueId);
    await notify({
      workspaceId: ws.id,
      actorId: me.id,
      type: "assigned",
      target: { kind: "issue", id: issueId },
      userIds: added,
      title: `${me.name} assigned you an issue`,
      body: before?.title ?? null,
    });
  }
  invalidate(ws.id, "issues");
}

export async function setIssueLabels(issueId: string, labelIds: string[]) {
  const ws = await getWorkspace();
  await db.delete(issueLabels).where(eq(issueLabels.issueId, issueId));
  if (labelIds.length) {
    await db.insert(issueLabels).values(labelIds.map((labelId) => ({ issueId, labelId })));
  }
  invalidate(ws.id, "issues");
}

/** Create a workspace label; color auto-picked from the palette when omitted. */
export async function createLabel(name: string, color?: string) {
  const text = name.trim();
  if (!text) throw new Error("Label name required.");
  const ws = await getWorkspace();
  const existing = await db
    .select({ id: labels.id })
    .from(labels)
    .where(eq(labels.workspaceId, ws.id));
  const picked = color ?? SELECT_COLORS[existing.length % SELECT_COLORS.length];
  const [row] = await db
    .insert(labels)
    .values({ workspaceId: ws.id, name: text, color: picked })
    .returning();
  invalidate(ws.id, "labels");
  return row;
}

export async function updateLabel(
  id: string,
  patch: { name?: string; color?: string },
) {
  const ws = await getWorkspace();
  const values: Record<string, unknown> = {};
  if (patch.name !== undefined) values.name = patch.name.trim();
  if (patch.color !== undefined) values.color = patch.color;
  if (Object.keys(values).length === 0) return;
  await db
    .update(labels)
    .set(values)
    .where(and(eq(labels.workspaceId, ws.id), eq(labels.id, id)));
  invalidate(ws.id, "labels");
}

export async function deleteLabel(id: string) {
  // issueLabels.labelId FK is ON DELETE CASCADE, so this also detaches issues.
  const ws = await getWorkspace();
  await db.delete(labels).where(and(eq(labels.workspaceId, ws.id), eq(labels.id, id)));
  invalidate(ws.id, "labels");
}

// ---- Pages ----

export async function createPage(
  parentId?: string | null,
  projectId?: string | null,
) {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  // A sub-page inherits its parent's scope (company wiki vs a project's Docs);
  // a root page uses the explicit projectId (null = company wiki).
  let scope = projectId ?? null;
  if (parentId) {
    const [parent] = await db
      .select({ projectId: pages.projectId })
      .from(pages)
      .where(and(eq(pages.workspaceId, ws.id), eq(pages.id, parentId)))
      .limit(1);
    if (parent) scope = parent.projectId;
  }
  const [created] = await db
    .insert(pages)
    .values({
      workspaceId: ws.id,
      parentId: parentId ?? null,
      projectId: scope,
      title: "Untitled",
      creatorId: me.id,
      position: `a${Date.now()}`,
    })
    .returning();
  await dispatchWebhook(ws.id, "page.created", { id: created.id, title: created.title });
  invalidate(ws.id, "pages");
  return created;
}

export async function updatePage(
  id: string,
  patch: Partial<{ title: string; icon: string; content: unknown }>,
  opts?: { knownUpdatedAt?: string | null },
): Promise<{ conflict: boolean }> {
  const ws = await getWorkspace();
  const now = new Date();
  const values: Record<string, unknown> = { updatedAt: now };
  if (patch.title !== undefined) values.title = patch.title;
  if (patch.icon !== undefined) values.icon = patch.icon;

  let conflict = false;

  // A content save is the interesting case: it drives versioning + the
  // last-write-wins conflict check. Read the current row once for both.
  if (patch.content !== undefined) {
    values.content = patch.content;
    values.contentText = docToText(patch.content).slice(0, 20000);

    const [current] = await db
      .select({
        title: pages.title,
        content: pages.content,
        updatedAt: pages.updatedAt,
      })
      .from(pages)
      .where(and(eq(pages.workspaceId, ws.id), eq(pages.id, id)))
      .limit(1);

    // Conflict guard: if the DB was written after the copy the client loaded,
    // someone else edited it. We still apply (LWW) but flag it so the client
    // can warn and point the user at version history.
    if (current && opts?.knownUpdatedAt) {
      const known = new Date(opts.knownUpdatedAt).getTime();
      if (current.updatedAt.getTime() - known > 1000) conflict = true;
    }

    // Snapshot the PRE-update state at most once per window (see spec) — but
    // always on a conflict, whatever the window says. Saves are last-write-wins,
    // so on a conflict this row IS the other person's work and we are about to
    // overwrite it; skipping the snapshot because one happened eight minutes ago
    // is how their edit disappears for good. `cause` records which it was, so
    // "how often does this actually happen" is a query rather than a guess.
    if (current) {
      const me = await getCurrentUser(ws.id);
      const [last] = await db
        .select({ createdAt: pageVersions.createdAt })
        .from(pageVersions)
        .where(eq(pageVersions.pageId, id))
        .orderBy(desc(pageVersions.createdAt))
        .limit(1);
      if (conflict || shouldSnapshot(last?.createdAt ?? null, now)) {
        await db.insert(pageVersions).values({
          workspaceId: ws.id,
          pageId: id,
          title: current.title,
          content: current.content,
          authorId: me.id,
          cause: conflict ? "conflict" : "auto",
        });
        await prunePageVersions(id);
      }
    }

    await syncReferences(ws.id, "page", id, patch.content);
  }

  await db
    .update(pages)
    .set(values)
    .where(and(eq(pages.workspaceId, ws.id), eq(pages.id, id)));

  invalidate(ws.id, "pages", "issues");
  return { conflict };
}

/** Keep only the newest VERSION_RETENTION versions for a page. */
async function prunePageVersions(pageId: string) {
  const keep = await db
    .select({ id: pageVersions.id })
    .from(pageVersions)
    .where(eq(pageVersions.pageId, pageId))
    .orderBy(desc(pageVersions.createdAt))
    .limit(VERSION_RETENTION);
  if (keep.length < VERSION_RETENTION) return;
  const cutoff = keep[keep.length - 1];
  const [cutoffRow] = await db
    .select({ createdAt: pageVersions.createdAt })
    .from(pageVersions)
    .where(eq(pageVersions.id, cutoff.id))
    .limit(1);
  if (!cutoffRow) return;
  await db
    .delete(pageVersions)
    .where(
      and(
        eq(pageVersions.pageId, pageId),
        lt(pageVersions.createdAt, cutoffRow.createdAt),
      ),
    );
}

/** Load a single version's full content (for the read-only history preview). */
export async function loadPageVersionContent(
  versionId: string,
): Promise<{ id: string; title: string; content: unknown } | null> {
  const ws = await getWorkspace();
  const [row] = await db
    .select({
      id: pageVersions.id,
      title: pageVersions.title,
      content: pageVersions.content,
    })
    .from(pageVersions)
    .where(
      and(eq(pageVersions.workspaceId, ws.id), eq(pageVersions.id, versionId)),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Restore a page to an earlier version. Snapshots the current state first
 * (cause 'restore') so the restore is itself undoable.
 */
export async function restorePageVersion(versionId: string) {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const [version] = await db
    .select({
      pageId: pageVersions.pageId,
      title: pageVersions.title,
      content: pageVersions.content,
    })
    .from(pageVersions)
    .where(
      and(eq(pageVersions.workspaceId, ws.id), eq(pageVersions.id, versionId)),
    )
    .limit(1);
  if (!version) throw new Error("Version not found.");

  const [current] = await db
    .select({ title: pages.title, content: pages.content })
    .from(pages)
    .where(and(eq(pages.workspaceId, ws.id), eq(pages.id, version.pageId)))
    .limit(1);
  if (!current) throw new Error("Page not found.");

  // Safety snapshot of the state we're overwriting.
  await db.insert(pageVersions).values({
    workspaceId: ws.id,
    pageId: version.pageId,
    title: current.title,
    content: current.content,
    authorId: me.id,
    cause: "restore",
  });
  await prunePageVersions(version.pageId);

  await db
    .update(pages)
    .set({
      title: version.title,
      content: version.content,
      contentText: docToText(version.content).slice(0, 20000),
      updatedAt: new Date(),
    })
    .where(and(eq(pages.workspaceId, ws.id), eq(pages.id, version.pageId)));
  await syncReferences(ws.id, "page", version.pageId, version.content);

  invalidate(ws.id, "pages");
}

/** Soft-delete: move a page (and its descendants) to the trash. */
export async function deletePage(id: string) {
  const ws = await getWorkspace();
  const now = new Date();

  // Collect the page and all descendants so a deleted subtree stays consistent.
  const all = await db
    .select({ id: pages.id, parentId: pages.parentId })
    .from(pages)
    .where(eq(pages.workspaceId, ws.id));
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
    .set({ deletedAt: now })
    .where(and(eq(pages.workspaceId, ws.id), inArray(pages.id, ids)));
  invalidate(ws.id, "pages");
}

export async function restorePage(id: string) {
  const ws = await getWorkspace();
  await db
    .update(pages)
    .set({ deletedAt: null })
    .where(and(eq(pages.workspaceId, ws.id), eq(pages.id, id)));
  invalidate(ws.id, "pages");
}

/** Permanently delete a trashed page. */
export async function deletePageForever(id: string) {
  const ws = await getWorkspace();
  await db.delete(pages).where(and(eq(pages.workspaceId, ws.id), eq(pages.id, id)));
  invalidate(ws.id, "pages");
}

// ---- Page comments ----

async function loadPageForComment(workspaceId: string, pageId: string) {
  const [page] = await db
    .select({ title: pages.title, creatorId: pages.creatorId })
    .from(pages)
    .where(and(eq(pages.workspaceId, workspaceId), eq(pages.id, pageId)))
    .limit(1);
  return page ?? null;
}

export async function createPageComment(
  pageId: string,
  body: string,
  opts?: { blockId?: string | null; parentId?: string | null },
) {
  const text = body.trim();
  if (!text) return;
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);

  await db.insert(pageComments).values({
    workspaceId: ws.id,
    pageId,
    parentId: opts?.parentId ?? null,
    blockId: opts?.blockId ?? null,
    authorId: me.id,
    body: text,
  });

  // Notify the page creator + @-mentioned members (a mention wins over the
  // generic notice so nobody is pinged twice). Page comments aren't tied to an
  // issue, so notifications carry no issueId.
  const page = await loadPageForComment(ws.id, pageId);
  if (page) {
    const members = await getMembers(ws.id);
    const target = { kind: "page" as const, id: pageId };
    const mentioned = findMentionedMemberIds(text, members).filter((uid) => uid !== me.id);

    await subscribe(ws.id, me.id, "page", pageId);
    await subscribeMany(ws.id, mentioned, "page", pageId);

    await notify({
      workspaceId: ws.id,
      actorId: me.id,
      type: "mentioned",
      target,
      userIds: mentioned,
      title: `${me.name} mentioned you on ${page.title}`,
      body: text.slice(0, 140),
    });

    const others = (await audienceFor(ws.id, target, me.id)).filter(
      (uid) => !mentioned.includes(uid),
    );
    await notify({
      workspaceId: ws.id,
      actorId: me.id,
      type: "commented",
      target,
      userIds: others,
      title: `${me.name} commented on ${page.title}`,
      body: text.slice(0, 140),
    });
  }

  invalidate(ws.id, "pages");
}

export async function deletePageComment(id: string) {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  // Author-only. Delete the comment and any replies to it.
  await db
    .delete(pageComments)
    .where(
      and(
        eq(pageComments.workspaceId, ws.id),
        eq(pageComments.id, id),
        eq(pageComments.authorId, me.id),
      ),
    );
  await db
    .delete(pageComments)
    .where(and(eq(pageComments.workspaceId, ws.id), eq(pageComments.parentId, id)));
  invalidate(ws.id, "pages");
}

export async function resolvePageComment(id: string) {
  const ws = await getWorkspace();
  await db
    .update(pageComments)
    .set({ resolvedAt: new Date() })
    .where(and(eq(pageComments.workspaceId, ws.id), eq(pageComments.id, id)));
  invalidate(ws.id, "pages");
}

export async function reopenPageComment(id: string) {
  const ws = await getWorkspace();
  await db
    .update(pageComments)
    .set({ resolvedAt: null })
    .where(and(eq(pageComments.workspaceId, ws.id), eq(pageComments.id, id)));
  invalidate(ws.id, "pages");
}

export async function togglePageCommentReaction(commentId: string, emoji: string) {
  if (!REACTION_EMOJI.has(emoji)) throw new Error("Unsupported reaction.");
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);

  const [c] = await db
    .select({ pageId: pageComments.pageId })
    .from(pageComments)
    .where(and(eq(pageComments.workspaceId, ws.id), eq(pageComments.id, commentId)))
    .limit(1);
  if (!c) throw new Error("Comment not found.");

  const [existing] = await db
    .select({ id: pageCommentReactions.id })
    .from(pageCommentReactions)
    .where(
      and(
        eq(pageCommentReactions.pageCommentId, commentId),
        eq(pageCommentReactions.userId, me.id),
        eq(pageCommentReactions.emoji, emoji),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .delete(pageCommentReactions)
      .where(eq(pageCommentReactions.id, existing.id));
  } else {
    await db
      .insert(pageCommentReactions)
      .values({ pageCommentId: commentId, userId: me.id, emoji })
      .onConflictDoNothing();
  }
  invalidate(ws.id, "pages");
}

// ---- Page presence ----

/**
 * Heartbeat own presence on a page and return the other users currently
 * active (fresh within PRESENCE_STALE_MS). One round-trip for both directions.
 * Stale rows are lazily deleted on read.
 */
export async function heartbeatPagePresence(
  pageId: string,
  blockId: string | null,
): Promise<PresenceUser[]> {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const now = new Date();

  await db
    .insert(pagePresence)
    .values({ pageId, userId: me.id, blockId, lastSeenAt: now })
    .onConflictDoUpdate({
      target: [pagePresence.pageId, pagePresence.userId],
      set: { blockId, lastSeenAt: now },
    });

  const staleBefore = new Date(now.getTime() - PRESENCE_STALE_MS);
  // Best-effort GC of stale rows for this page.
  await db
    .delete(pagePresence)
    .where(
      and(eq(pagePresence.pageId, pageId), lt(pagePresence.lastSeenAt, staleBefore)),
    );

  const rows = await db
    .select({
      userId: pagePresence.userId,
      blockId: pagePresence.blockId,
      name: users.name,
      avatarColor: users.avatarColor,
    })
    .from(pagePresence)
    .innerJoin(users, eq(users.id, pagePresence.userId))
    .where(
      and(
        eq(pagePresence.pageId, pageId),
        gte(pagePresence.lastSeenAt, staleBefore),
      ),
    );

  return rows
    .filter((r) => r.userId !== me.id)
    .map((r) => ({
      userId: r.userId,
      name: r.name,
      avatarColor: r.avatarColor,
      color: presenceColor(r.userId),
      blockId: r.blockId,
    }));
}

export async function leavePagePresence(pageId: string) {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  await db
    .delete(pagePresence)
    .where(and(eq(pagePresence.pageId, pageId), eq(pagePresence.userId, me.id)));
}

// ---- Issue relations ----

export async function addIssueRelation(
  issueId: string,
  relatedIssueId: string,
  type: string,
) {
  if (issueId === relatedIssueId) throw new Error("A task can't relate to itself.");
  if (!isRelationType(type)) throw new Error("Invalid relation type.");
  const ws = await getWorkspace();
  // Avoid duplicates in either direction for the same type.
  const existing = await db
    .select({ id: issueRelations.id })
    .from(issueRelations)
    .where(
      and(
        eq(issueRelations.workspaceId, ws.id),
        eq(issueRelations.type, type),
        or(
          and(
            eq(issueRelations.issueId, issueId),
            eq(issueRelations.relatedIssueId, relatedIssueId),
          ),
          and(
            eq(issueRelations.issueId, relatedIssueId),
            eq(issueRelations.relatedIssueId, issueId),
          ),
        ),
      ),
    )
    .limit(1);
  if (existing.length) return;

  await db.insert(issueRelations).values({
    workspaceId: ws.id,
    issueId,
    relatedIssueId,
    type,
  });
  invalidate(ws.id, "issues");
}

export async function removeIssueRelation(relationId: string) {
  const ws = await getWorkspace();
  await db
    .delete(issueRelations)
    .where(and(eq(issueRelations.workspaceId, ws.id), eq(issueRelations.id, relationId)));
  invalidate(ws.id, "issues");
}

// ---- Issue <-> Page links ----

export async function linkIssueToPage(issueId: string, pageId: string) {
  const ws = await getWorkspace();
  await db.insert(issuePageLinks).values({ issueId, pageId }).onConflictDoNothing();
  invalidate(ws.id, "issues", "pages");
}

export async function unlinkIssueFromPage(issueId: string, pageId: string) {
  const ws = await getWorkspace();
  await db
    .delete(issuePageLinks)
    .where(and(eq(issuePageLinks.issueId, issueId), eq(issuePageLinks.pageId, pageId)));
  invalidate(ws.id, "issues", "pages");
}

// ---- Cycles ----

export async function createCycle(input: {
  projectId: string;
  name?: string;
  startDate: string;
  endDate: string;
}) {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  // Cycles are project-scoped, so numbering restarts per project.
  const [{ value: maxNumber }] = await db
    .select({ value: max(cycles.number) })
    .from(cycles)
    .where(and(eq(cycles.workspaceId, ws.id), eq(cycles.projectId, input.projectId)));
  const number = (maxNumber ?? 0) + 1;
  const [created] = await db
    .insert(cycles)
    .values({
      workspaceId: ws.id,
      projectId: input.projectId,
      name: input.name?.trim() || `Cycle ${number}`,
      number,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
    })
    .returning();

  // Every cycle starts with the team's standing ceremonies already in it —
  // including the one rollover creates, which is the case that used to get
  // forgotten.
  await stampCadence(ws.id, me.id, created);

  invalidate(ws.id, "cycles", "issues");
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
  invalidate(ws.id, "cycles");
}

export async function deleteCycle(id: string) {
  const ws = await getWorkspace();
  await db.delete(cycles).where(and(eq(cycles.workspaceId, ws.id), eq(cycles.id, id)));
  invalidate(ws.id, "cycles");
}

/** Terminal statuses — work that a closing cycle leaves behind rather than carries. */
const FINISHED = ["done", "canceled"];

/**
 * Stamp a project's cadence ceremonies into one cycle.
 *
 * Idempotent by task title, so it is safe on every cycle creation and safe to
 * re-run by hand after the cadence changes — an existing ceremony is left
 * alone and only genuinely new ones are added. Returns how many it created.
 */
async function stampCadence(
  workspaceId: string,
  creatorId: string,
  cycle: { id: string; projectId: string; startDate: Date; endDate: Date },
): Promise<number> {
  const [project] = await db
    .select({ cadence: projects.cycleCadence })
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, cycle.projectId)))
    .limit(1);
  if (!project || isCadenceEmpty(project.cadence)) return 0;

  const existing = await db
    .select({ title: issues.title })
    .from(issues)
    .where(and(eq(issues.workspaceId, workspaceId), eq(issues.cycleId, cycle.id)));

  const tasks = ceremonyTasksFor(
    project.cadence,
    cycle,
    existing.map((e) => e.title),
  );
  if (tasks.length === 0) return 0;

  // Numbering restarts per project, matching createIssue.
  const [{ value: maxNumber }] = await db
    .select({ value: max(issues.number) })
    .from(issues)
    .where(and(eq(issues.workspaceId, workspaceId), eq(issues.projectId, cycle.projectId)));

  await db.insert(issues).values(
    tasks.map((t, i) => ({
      workspaceId,
      projectId: cycle.projectId,
      cycleId: cycle.id,
      number: (maxNumber ?? 0) + 1 + i,
      title: t.title,
      type: t.type,
      priority: t.priority,
      status: "todo",
      estimate: t.estimate,
      dueDate: t.dueDate,
      creatorId,
      sortKey: `a${Date.now() + i}`,
    })),
  );

  return tasks.length;
}

/** Support priorities map onto task priorities; only "normal" differs in name. */
const TICKET_TO_ISSUE_PRIORITY: Record<string, string> = {
  urgent: "urgent",
  high: "high",
  normal: "medium",
  low: "low",
};

/**
 * Turn a support ticket into a task, keeping the thread back to the reporter.
 *
 * Support and engineering run as separate systems here, and without this the
 * only way across is retyping — which loses the account, the contact and the
 * conversation that produced the work. The ticket keeps its own lifecycle (it
 * is still the customer's open thread) and simply gains a link.
 *
 * Idempotent: a ticket already converted returns its existing task rather than
 * creating a second one.
 */
export async function convertTicketToIssue(ticketId: string) {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);

  const [ticket] = await db
    .select()
    .from(tickets)
    .where(and(eq(tickets.workspaceId, ws.id), eq(tickets.id, ticketId)))
    .limit(1);
  if (!ticket) throw new Error("Ticket not found");

  if (ticket.issueId) {
    const [existing] = await db
      .select()
      .from(issues)
      .where(and(eq(issues.workspaceId, ws.id), eq(issues.id, ticket.issueId)))
      .limit(1);
    if (existing) return { issue: existing, created: false };
  }

  const [{ value: maxNumber }] = await db
    .select({ value: max(issues.number) })
    .from(issues)
    .where(
      ticket.projectId
        ? and(eq(issues.workspaceId, ws.id), eq(issues.projectId, ticket.projectId))
        : eq(issues.workspaceId, ws.id),
    );

  const [created] = await db
    .insert(issues)
    .values({
      workspaceId: ws.id,
      projectId: ticket.projectId,
      number: (maxNumber ?? 0) + 1,
      title: ticket.subject,
      // The ticket body is plain text; the editor stores a TipTap document.
      description: ticket.body
        ? {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: ticket.body }] }],
          }
        : null,
      status: "todo",
      priority: TICKET_TO_ISSUE_PRIORITY[ticket.priority] ?? "none",
      // Support work is rarely engineering-only; "ops" is the honest default
      // and the type picker is one click away on the task.
      type: "ops",
      assigneeId: ticket.assigneeId,
      creatorId: me.id,
      sortKey: `a${Date.now()}`,
    })
    .returning();

  await db
    .update(tickets)
    .set({ issueId: created.id, updatedAt: new Date() })
    .where(and(eq(tickets.workspaceId, ws.id), eq(tickets.id, ticketId)));

  invalidate(ws.id, "issues", "tickets");
  return { issue: created, created: true };
}

/** Re-apply the project's cadence to an existing cycle. Adds only what's missing. */
export async function applyCadenceToCycle(cycleId: string): Promise<number> {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const [cycle] = await db
    .select()
    .from(cycles)
    .where(and(eq(cycles.workspaceId, ws.id), eq(cycles.id, cycleId)))
    .limit(1);
  if (!cycle) throw new Error("Cycle not found");

  const added = await stampCadence(ws.id, me.id, cycle);
  if (added > 0) invalidate(ws.id, "issues", "cycles");
  return added;
}

/** Replace a project's cadence. Existing cycles keep whatever they already have. */
export async function updateCycleCadence(projectId: string, cadence: CycleCadence) {
  const ws = await getWorkspace();
  const normalized = normalizeCadence(cadence);
  await db
    .update(projects)
    .set({ cycleCadence: normalized.ceremonies.length > 0 ? normalized : null })
    .where(and(eq(projects.workspaceId, ws.id), eq(projects.id, projectId)));
  invalidate(ws.id, "projects");
  return normalized;
}

/**
 * Carry a cycle's unfinished work into the next one.
 *
 * Without this, closing a cycle silently strands whatever didn't land: the
 * tasks keep pointing at a cycle that's over, so they fall out of the next
 * plan and off the burndown. Moves everything that isn't done or canceled
 * into the following cycle, creating that cycle (same length, starting when
 * this one ends) when it doesn't exist yet.
 *
 * Idempotent: running it twice moves nothing the second time, because the
 * first run left no unfinished tasks behind.
 */
export async function rollOverCycle(id: string) {
  const ws = await getWorkspace();
  const [cycle] = await db
    .select()
    .from(cycles)
    .where(and(eq(cycles.workspaceId, ws.id), eq(cycles.id, id)))
    .limit(1);
  if (!cycle) throw new Error("Cycle not found");

  const unfinished = await db
    .select({ id: issues.id })
    .from(issues)
    .where(
      and(
        eq(issues.workspaceId, ws.id),
        eq(issues.cycleId, id),
        notInArray(issues.status, FINISHED),
      ),
    );

  // The next cycle is the soonest one starting after this one — not simply the
  // next number, since cycles can be created out of order.
  const [existingNext] = await db
    .select()
    .from(cycles)
    .where(
      and(
        eq(cycles.workspaceId, ws.id),
        eq(cycles.projectId, cycle.projectId),
        gt(cycles.startDate, cycle.startDate),
      ),
    )
    .orderBy(asc(cycles.startDate))
    .limit(1);

  const target =
    existingNext ??
    (await createCycle({
      projectId: cycle.projectId,
      startDate: cycle.endDate.toISOString(),
      endDate: new Date(
        cycle.endDate.getTime() + (cycle.endDate.getTime() - cycle.startDate.getTime()),
      ).toISOString(),
    }));

  if (unfinished.length > 0) {
    await db
      .update(issues)
      .set({ cycleId: target.id, updatedAt: new Date() })
      .where(
        and(
          eq(issues.workspaceId, ws.id),
          inArray(
            issues.id,
            unfinished.map((i) => i.id),
          ),
        ),
      );
  }

  invalidate(ws.id, "cycles", "issues");
  return { movedCount: unfinished.length, cycle: target, created: !existingNext };
}


const PROJECT_COLORS = [
  "#6366f1", "#ec4899", "#10b981", "#f59e0b", "#3b82f6",
  "#a855f7", "#ef4444", "#14b8a6", "#f97316", "#8b5cf6",
];

/** Create a project, deriving a unique key prefix from its name. */
export async function createProject(input: {
  name: string;
  key?: string;
  kind?: "project" | "operation";
  ownerId?: string | null;
}) {
  const ws = await getWorkspace();
  const name = input.name.trim() || "New project";
  const base =
    (input.key?.trim() || name.replace(/[^A-Za-z0-9]/g, "").slice(0, 4) || "PRJ")
      .toUpperCase()
      .slice(0, 6) || "PRJ";

  const existing = await db
    .select({ key: projects.key })
    .from(projects)
    .where(eq(projects.workspaceId, ws.id));
  const taken = new Set(existing.map((p) => p.key));
  let key = base;
  let n = 1;
  while (taken.has(key)) key = `${base}${n++}`;

  const [created] = await db
    .insert(projects)
    .values({
      workspaceId: ws.id,
      name,
      key,
      color: PROJECT_COLORS[taken.size % PROJECT_COLORS.length],
      kind: input.kind ?? "project",
      ownerId: input.ownerId ?? null,
    })
    .returning();
  await dispatchWebhook(ws.id, "project.created", {
    id: created.id,
    name: created.name,
    key: created.key,
  });
  invalidate(ws.id, "projects");
  return created;
}

export async function updateProject(
  id: string,
  patch: Partial<{
    name: string;
    description: string;
    color: string;
    startDate: string | null;
    targetDate: string | null;
    ownerId: string | null;
  }>,
) {
  const ws = await getWorkspace();
  const values: Record<string, unknown> = {};
  if (patch.name !== undefined) values.name = patch.name.trim() || "Untitled project";
  if (patch.description !== undefined) values.description = patch.description;
  if (patch.color !== undefined) values.color = patch.color;
  if (patch.ownerId !== undefined) values.ownerId = patch.ownerId;
  if (patch.startDate !== undefined)
    values.startDate = patch.startDate ? new Date(patch.startDate) : null;
  if (patch.targetDate !== undefined)
    values.targetDate = patch.targetDate ? new Date(patch.targetDate) : null;
  if (Object.keys(values).length === 0) return;
  await db
    .update(projects)
    .set(values)
    .where(and(eq(projects.workspaceId, ws.id), eq(projects.id, id)));
  invalidate(ws.id, "projects");
}

const HEALTH = new Set(["on_track", "at_risk", "off_track"]);

export async function addStatusUpdate(
  projectId: string,
  health: string,
  body: string,
) {
  if (!HEALTH.has(health)) throw new Error("Invalid health value.");
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  await db.insert(projectStatusUpdates).values({
    workspaceId: ws.id,
    projectId,
    authorId: me.id,
    health,
    body: body.trim(),
  });
  invalidate(ws.id, "status-updates");
}

export async function deleteStatusUpdate(id: string) {
  const ws = await getWorkspace();
  await db
    .delete(projectStatusUpdates)
    .where(
      and(
        eq(projectStatusUpdates.workspaceId, ws.id),
        eq(projectStatusUpdates.id, id),
      ),
    );
  invalidate(ws.id, "status-updates");
}

export async function deleteProject(id: string) {
  const ws = await getWorkspace();
  await requireAdmin(ws.id);
  // Detach issues from the project rather than deleting them.
  await db
    .update(issues)
    .set({ projectId: null })
    .where(and(eq(issues.workspaceId, ws.id), eq(issues.projectId, id)));
  await db
    .delete(projects)
    .where(and(eq(projects.workspaceId, ws.id), eq(projects.id, id)));
  invalidate(ws.id, "issues", "projects");
}


// ---- Databases ----

export async function createDatabase(input: { name?: string }) {
  const ws = await getWorkspace();
  const [database] = await db
    .insert(databases)
    .values({ workspaceId: ws.id, name: input.name?.trim() || "Untitled database" })
    .returning();
  // Default schema: a Name (text) and Status (select) field, plus a few rows.
  await db.insert(databaseFields).values([
    { databaseId: database.id, name: "Name", type: "text", position: "a0" },
    {
      databaseId: database.id,
      name: "Status",
      type: "select",
      position: "a1",
      options: [
        { label: "Todo", color: "#64748b" },
        { label: "In progress", color: "#f59e0b" },
        { label: "Done", color: "#10b981" },
      ],
    },
  ]);
  await db.insert(databaseRows).values([
    { databaseId: database.id, values: {}, position: "a0" },
    { databaseId: database.id, values: {}, position: "a1" },
    { databaseId: database.id, values: {}, position: "a2" },
  ]);
  invalidate(ws.id, "databases");
  return database;
}

export async function updateDatabase(
  id: string,
  patch: Partial<{ name: string; icon: string }>,
) {
  const ws = await getWorkspace();
  await db
    .update(databases)
    .set(patch)
    .where(and(eq(databases.workspaceId, ws.id), eq(databases.id, id)));
  invalidate(ws.id, "databases");
}

export async function deleteDatabase(id: string) {
  const ws = await getWorkspace();
  await requireAdmin(ws.id);
  await db
    .delete(databases)
    .where(and(eq(databases.workspaceId, ws.id), eq(databases.id, id)));
  invalidate(ws.id, "databases");
}

export async function addField(
  databaseId: string,
  input: {
    name: string;
    type: string;
    relationDatabaseId?: string | null;
    config?: unknown;
  },
) {
  const ws = await getWorkspace();
  await db.insert(databaseFields).values({
    databaseId,
    name: input.name.trim() || "Field",
    type: input.type,
    position: `a${Date.now()}`,
    options:
      input.type === "select" || input.type === "multiSelect"
        ? [{ label: "Option 1", color: "#6366f1" }]
        : null,
    relationDatabaseId:
      input.type === "relation" ? input.relationDatabaseId ?? null : null,
    config: input.type === "rollup" ? (input.config ?? null) : null,
  });
  invalidate(ws.id, "databases");
}

export async function updateField(
  id: string,
  databaseId: string,
  patch: Partial<{ name: string; type: string; options: unknown }>,
) {
  const ws = await getWorkspace();
  await db.update(databaseFields).set(patch).where(eq(databaseFields.id, id));
  invalidate(ws.id, "databases");
}

export async function deleteField(id: string) {
  const ws = await getWorkspace();
  await db.delete(databaseFields).where(eq(databaseFields.id, id));
  invalidate(ws.id, "databases");
}

/** Persist a table column width. No revalidate — the client already shows it. */
export async function setFieldWidth(id: string, width: number) {
  await db
    .update(databaseFields)
    .set({ width: Math.round(width) })
    .where(eq(databaseFields.id, id));
}

export async function addRow(databaseId: string) {
  const ws = await getWorkspace();
  await db
    .insert(databaseRows)
    .values({ databaseId, values: {}, position: `a${Date.now()}` });
  invalidate(ws.id, "databases");
}

export async function updateCell(
  rowId: string,
  databaseId: string,
  fieldId: string,
  value: unknown,
) {
  const ws = await getWorkspace();
  const [row] = await db
    .select({ values: databaseRows.values })
    .from(databaseRows)
    .where(eq(databaseRows.id, rowId))
    .limit(1);
  const next = { ...((row?.values as Record<string, unknown>) ?? {}), [fieldId]: value };
  await db.update(databaseRows).set({ values: next }).where(eq(databaseRows.id, rowId));
  invalidate(ws.id, "databases");
}

export async function deleteRow(id: string) {
  const ws = await getWorkspace();
  await db.delete(databaseRows).where(eq(databaseRows.id, id));
  invalidate(ws.id, "databases");
}

export async function duplicateRow(id: string, databaseId: string) {
  const ws = await getWorkspace();
  const [row] = await db
    .select({ values: databaseRows.values })
    .from(databaseRows)
    .where(eq(databaseRows.id, id))
    .limit(1);
  if (!row) return;
  await db
    .insert(databaseRows)
    .values({ databaseId, values: row.values ?? {}, position: `a${Date.now()}` });
  invalidate(ws.id, "databases");
}

// ---- GitHub issue sync ----

export async function setGithubConfig(input: { repo: string; token: string }) {
  const ws = await getWorkspace();
  await requireAdmin(ws.id);
  const repo = input.repo.trim();
  const token = input.token.trim();
  if (repo && token) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo))
      throw new Error("Repository must be in the form owner/repo.");
    const ok = await verifyGithubRepo(repo, token);
    if (!ok)
      throw new Error("Couldn't access that repo. Check the name and that the token has 'repo' (or Issues: write) scope.");
  }
  await db
    .update(workspaces)
    .set({ githubRepo: repo || null, githubToken: token || null })
    .where(eq(workspaces.id, ws.id));
  refresh();
}

export async function disconnectGithub() {
  const ws = await getWorkspace();
  await requireAdmin(ws.id);
  await db
    .update(workspaces)
    .set({ githubRepo: null, githubToken: null })
    .where(eq(workspaces.id, ws.id));
  refresh();
}

/** Push an internal issue to GitHub and link it back. */
export async function pushIssueToGithub(issueId: string) {
  const ws = await getWorkspace();
  const [issue] = await db
    .select()
    .from(issues)
    .where(and(eq(issues.workspaceId, ws.id), eq(issues.id, issueId)))
    .limit(1);
  if (!issue) throw new Error("Task not found.");
  if (issue.githubUrl) return;
  const body = docToText(issue.description) || "_Created from the internal workspace._";
  const { number, htmlUrl } = await createGithubIssue(ws.id, {
    title: issue.title,
    body,
  });
  await db
    .update(issues)
    .set({ githubUrl: htmlUrl, githubNumber: number })
    .where(eq(issues.id, issueId));
  invalidate(ws.id, "issues");
}

// ---- Attachments ----

export async function uploadAttachment(issueId: string, formData: FormData) {
  if (!isBlobConfigured()) {
    throw new Error(
      "File storage isn't configured. Add a BLOB_READ_WRITE_TOKEN to enable attachments.",
    );
  }
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No file provided.");
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("File is too large (max 10 MB).");
  }

  // Confirm the issue belongs to this workspace before storing.
  const [issue] = await db
    .select({ id: issues.id })
    .from(issues)
    .where(and(eq(issues.workspaceId, ws.id), eq(issues.id, issueId)))
    .limit(1);
  if (!issue) throw new Error("Task not found.");

  const blob = await put(`${ws.id}/${issueId}/${file.name}`, file, {
    access: "public",
    addRandomSuffix: true,
  });

  await db.insert(attachments).values({
    workspaceId: ws.id,
    issueId,
    uploaderId: me.id,
    name: file.name,
    url: blob.url,
    contentType: file.type || null,
    size: file.size,
  });

  updateTag(issueAttachmentsTag(issueId));
  refresh();
}

/** Upload an image for embedding inline in the rich-text editor; returns its URL. */
export async function uploadEditorImage(formData: FormData): Promise<string> {
  if (!isBlobConfigured()) {
    throw new Error("Image storage isn't configured. Add a BLOB_READ_WRITE_TOKEN to embed images.");
  }
  const ws = await getWorkspace();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No image provided.");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Only images can be embedded.");
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("Image is too large (max 10 MB).");
  }
  const blob = await put(`${ws.id}/editor/${file.name}`, file, {
    access: "public",
    addRandomSuffix: true,
  });
  return blob.url;
}

export async function deleteAttachment(id: string, issueId: string) {
  const ws = await getWorkspace();
  const [row] = await db
    .select({ url: attachments.url })
    .from(attachments)
    .where(and(eq(attachments.workspaceId, ws.id), eq(attachments.id, id)))
    .limit(1);
  if (!row) return;
  if (isBlobConfigured()) {
    try {
      await del(row.url);
    } catch {
      // Best-effort: still remove the DB row even if blob delete fails.
    }
  }
  await db
    .delete(attachments)
    .where(and(eq(attachments.workspaceId, ws.id), eq(attachments.id, id)));
  updateTag(issueAttachmentsTag(issueId));
  refresh();
}

// ---- Favorites ----

const FAVORITE_KINDS = new Set(["issue", "page", "project"]);

/** Toggle a favorite for the current user; returns the new favorited state. */
/**
 * Follow or unfollow a task, page or project. Returns the resulting state so
 * the button can settle on the server's answer rather than its optimistic one.
 */
export async function toggleSubscription(
  kind: string,
  targetId: string,
): Promise<boolean> {
  if (!SUBSCRIBABLE.has(kind)) throw new Error("Invalid subscription kind.");
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const following = await subscriberIds(ws.id, kind, targetId);
  if (following.includes(me.id)) {
    await unsubscribe(ws.id, me.id, kind, targetId);
    return false;
  }
  await subscribe(ws.id, me.id, kind, targetId);
  return true;
}

export async function toggleFavorite(
  kind: string,
  targetId: string,
): Promise<boolean> {
  if (!FAVORITE_KINDS.has(kind)) throw new Error("Invalid favorite kind.");
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const [existing] = await db
    .select({ id: favorites.id })
    .from(favorites)
    .where(
      and(
        eq(favorites.userId, me.id),
        eq(favorites.kind, kind),
        eq(favorites.targetId, targetId),
      ),
    )
    .limit(1);

  let favorited: boolean;
  if (existing) {
    await db.delete(favorites).where(eq(favorites.id, existing.id));
    favorited = false;
  } else {
    await db
      .insert(favorites)
      .values({ workspaceId: ws.id, userId: me.id, kind, targetId })
      .onConflictDoNothing();
    favorited = true;
  }
  refresh();
  return favorited;
}

// ---- Notifications ----

export async function markNotificationRead(id: string) {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  await db
    .update(notifications)
    .set({ read: new Date() })
    .where(
      and(
        eq(notifications.workspaceId, ws.id),
        eq(notifications.userId, me.id),
        eq(notifications.id, id),
      ),
    );
  refresh();
}

export async function markAllNotificationsRead() {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  await db
    .update(notifications)
    .set({ read: new Date() })
    .where(
      and(
        eq(notifications.workspaceId, ws.id),
        eq(notifications.userId, me.id),
        isNull(notifications.read),
      ),
    );
  refresh();
}

// ---- AI ----

function textToDoc(text: string): unknown {
  const clean = text.trim();
  if (!clean) return null;
  return {
    type: "doc",
    content: clean.split(/\n{2,}/).map((para) => ({
      type: "paragraph",
      content: [{ type: "text", text: para.trim() }],
    })),
  };
}

/** Ask Claude to turn a doc into a list of proposed issues (no DB writes). */
export async function proposeIssuesFromPage(
  pageId: string,
): Promise<import("@/lib/types").ProposedIssue[]> {
  if (!isAiConfigured()) {
    throw new Error("AI isn't configured. Add an ANTHROPIC_API_KEY to enable this.");
  }
  const ws = await getWorkspace();
  const [page] = await db
    .select({ title: pages.title, content: pages.content })
    .from(pages)
    .where(and(eq(pages.workspaceId, ws.id), eq(pages.id, pageId)))
    .limit(1);
  if (!page) throw new Error("Page not found.");

  const body = `# ${page.title}\n\n${docToText(page.content)}`.slice(0, 12000);
  const out = await callClaude({
    maxTokens: 1500,
    system:
      "You turn product/spec documents into a concrete list of actionable engineering issues. " +
      "Return ONLY a JSON array of objects with `title` (short, imperative) and `description` " +
      "(1-3 sentences of context). Aim for 3-12 issues. No prose outside the JSON.",
    prompt: `Extract the issues from this document:\n\n${body}`,
  });

  return extractJsonArray(out)
    .map(normalizeProposedIssue)
    .filter((x): x is import("@/lib/types").ProposedIssue => x !== null)
    .slice(0, 20);
}

/** Create the chosen proposed issues and link them back to the source page. */
export async function createIssuesFromProposals(
  pageId: string,
  proposals: { title: string; description: string }[],
): Promise<number> {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const [{ value: maxNumber }] = await db
    .select({ value: max(issues.number) })
    .from(issues)
    .where(eq(issues.workspaceId, ws.id));

  let n = maxNumber ?? 0;
  let created = 0;
  for (const p of proposals) {
    const title = p.title?.trim();
    if (!title) continue;
    n += 1;
    const [issue] = await db
      .insert(issues)
      .values({
        workspaceId: ws.id,
        number: n,
        title: title.slice(0, 200),
        description: textToDoc(p.description ?? ""),
        status: "backlog",
        priority: "none",
        creatorId: me.id,
        sortKey: `a${Date.now()}${created}`,
      })
      .returning();
    await db
      .insert(issuePageLinks)
      .values({ issueId: issue.id, pageId })
      .onConflictDoNothing();
    created += 1;
  }

  invalidate(ws.id, "issues", "pages");
  return created;
}

const STOPWORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "her", "was",
  "one", "our", "out", "his", "has", "how", "who", "what", "why", "does", "did",
  "with", "this", "that", "from", "have", "about", "which", "when", "where",
]);

function keywords(question: string): string[] {
  return [
    ...new Set(
      question
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
    ),
  ].slice(0, 8);
}

/** Answer a question grounded in the workspace's docs and issues (keyword RAG). */
export async function askWorkspace(
  question: string,
): Promise<import("@/lib/types").AskResult> {
  if (!isAiConfigured()) {
    throw new Error("AI isn't configured. Add an ANTHROPIC_API_KEY to enable this.");
  }
  const q = question.trim();
  if (!q) return { answer: "", sources: [] };
  const ws = await getWorkspace();
  const kws = keywords(q);
  if (kws.length === 0) return { answer: "Try a more specific question.", sources: [] };

  const pageOr = or(
    ...kws.flatMap((k) => [
      ilike(pages.title, `%${k}%`),
      ilike(pages.contentText, `%${k}%`),
    ]),
  );
  const issueOr = or(...kws.map((k) => ilike(issues.title, `%${k}%`)));

  const [pageRows, issueRows] = await Promise.all([
    db
      .select({ id: pages.id, title: pages.title, contentText: pages.contentText })
      .from(pages)
      .where(and(eq(pages.workspaceId, ws.id), isNull(pages.deletedAt), pageOr))
      .limit(8),
    db
      .select({
        id: issues.id,
        title: issues.title,
        description: issues.description,
        number: issues.number,
        projectKey: projects.key,
      })
      .from(issues)
      .leftJoin(projects, eq(issues.projectId, projects.id))
      .where(and(eq(issues.workspaceId, ws.id), issueOr))
      .limit(8),
  ]);

  const sources: import("@/lib/types").AskSource[] = [];
  const blocks: string[] = [];
  for (const p of pageRows) {
    sources.push({ kind: "page", title: p.title || "Untitled", href: `/pages/${p.id}` });
    blocks.push(`[Doc: ${p.title}]\n${(p.contentText || "").slice(0, 1500)}`);
  }
  for (const r of issueRows) {
    const ident = r.projectKey ? `${r.projectKey}-${r.number}` : `#${r.number}`;
    sources.push({ kind: "issue", title: `${ident} ${r.title}`, href: `/issues/${r.id}` });
    blocks.push(`[Issue ${ident}: ${r.title}]\n${docToText(r.description).slice(0, 800)}`);
  }

  if (blocks.length === 0) {
    return { answer: "I couldn't find anything relevant in this workspace.", sources: [] };
  }

  const answer = await callClaude({
    maxTokens: 800,
    system:
      "You answer questions about a team's workspace using ONLY the provided docs and issues. " +
      "Be concise. If the context doesn't contain the answer, say so. Don't invent facts.",
    prompt: `Question: ${q}\n\nContext:\n\n${blocks.join("\n\n---\n\n").slice(0, 14000)}`,
  });

  return { answer, sources };
}

// ---- Embedded issue views (live blocks inside docs) ----

export type EmbedProject = { id: string; name: string; color: string };

export async function getEmbedProjects(): Promise<EmbedProject[]> {
  const ws = await getWorkspace();
  return db
    .select({ id: projects.id, name: projects.name, color: projects.color })
    .from(projects)
    .where(eq(projects.workspaceId, ws.id))
    .orderBy(projects.name);
}

export type EmbeddedIssue = {
  id: string;
  title: string;
  status: string;
  identifier: string;
};

/** Run a saved filter for an embedded issue view inside a document. */
export async function queryEmbeddedIssues(filter: {
  projectId?: string | null;
  status?: string | null;
}): Promise<EmbeddedIssue[]> {
  const ws = await getWorkspace();
  const conds = [eq(issues.workspaceId, ws.id)];
  if (filter.projectId) conds.push(eq(issues.projectId, filter.projectId));
  if (filter.status && isStatus(filter.status)) conds.push(eq(issues.status, filter.status));

  const rows = await db
    .select({
      id: issues.id,
      title: issues.title,
      status: issues.status,
      number: issues.number,
      projectKey: projects.key,
    })
    .from(issues)
    .leftJoin(projects, eq(issues.projectId, projects.id))
    .where(and(...conds))
    .orderBy(issues.sortKey)
    .limit(25);

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    identifier: r.projectKey ? `${r.projectKey}-${r.number}` : `#${r.number}`,
  }));
}

// ---- API keys ----

export async function createApiKey(
  name: string,
): Promise<{ key: string; prefix: string }> {
  const ws = await getWorkspace();
  await requireAdmin(ws.id);
  const me = await getCurrentUser(ws.id);
  const { key, hash, prefix } = generateApiKey();
  await db.insert(apiKeys).values({
    workspaceId: ws.id,
    name: name.trim().slice(0, 60) || "API key",
    keyHash: hash,
    keyPrefix: prefix,
    createdBy: me.id,
  });
  invalidate(ws.id, "api");
  return { key, prefix };
}

export async function revokeApiKey(id: string) {
  const ws = await getWorkspace();
  await requireAdmin(ws.id);
  await db.delete(apiKeys).where(and(eq(apiKeys.workspaceId, ws.id), eq(apiKeys.id, id)));
  invalidate(ws.id, "api");
}

// ---- Webhooks ----

export async function createWebhook(
  url: string,
  events: string[],
): Promise<{ secret: string }> {
  const ws = await getWorkspace();
  await requireAdmin(ws.id);
  const me = await getCurrentUser(ws.id);
  const clean = url.trim();
  if (!/^https?:\/\//.test(clean)) throw new Error("Enter a valid http(s) URL.");
  const valid = events.filter((e) => e === "*" || WEBHOOK_EVENTS.includes(e as never));
  const secret = newWebhookSecret();
  await db.insert(webhooks).values({
    workspaceId: ws.id,
    url: clean,
    secret,
    events: valid.length ? valid : ["*"],
    createdBy: me.id,
  });
  invalidate(ws.id, "api");
  return { secret };
}

export async function setWebhookActive(id: string, active: boolean) {
  const ws = await getWorkspace();
  await requireAdmin(ws.id);
  await db
    .update(webhooks)
    .set({ active })
    .where(and(eq(webhooks.workspaceId, ws.id), eq(webhooks.id, id)));
  invalidate(ws.id, "api");
}

export async function deleteWebhook(id: string) {
  const ws = await getWorkspace();
  await requireAdmin(ws.id);
  await db.delete(webhooks).where(and(eq(webhooks.workspaceId, ws.id), eq(webhooks.id, id)));
  invalidate(ws.id, "api");
}

// ---- Saved views ----

export async function createSavedView(
  name: string,
  config: import("@/lib/types").SavedViewConfig,
) {
  const clean = name.trim();
  if (!clean) throw new Error("Give the view a name.");
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const [created] = await db
    .insert(savedViews)
    .values({ workspaceId: ws.id, createdBy: me.id, name: clean.slice(0, 60), config })
    .returning();
  invalidate(ws.id, "saved-views");
  return { id: created.id, name: created.name };
}

export async function deleteSavedView(id: string) {
  const ws = await getWorkspace();
  await db
    .delete(savedViews)
    .where(and(eq(savedViews.workspaceId, ws.id), eq(savedViews.id, id)));
  invalidate(ws.id, "saved-views");
}

// ---- Global search (⌘K) ----

export async function searchWorkspace(
  query: string,
): Promise<import("@/lib/types").SearchResult[]> {
  const ws = await getWorkspace();
  const q = query.trim();
  if (!q) return [];
  const term = `%${q}%`;
  const LIMIT = 6;

  const [
    issueRows,
    pageRows,
    projectRows,
    databaseRows_,
    cycleRows,
  ] = await Promise.all([
    db
      .select({
        id: issues.id,
        title: issues.title,
        number: issues.number,
        status: issues.status,
        projectKey: projects.key,
      })
      .from(issues)
      .leftJoin(projects, eq(issues.projectId, projects.id))
      .where(and(eq(issues.workspaceId, ws.id), ilike(issues.title, term)))
      .limit(LIMIT),
    db
      .select({
        id: pages.id,
        title: pages.title,
        icon: pages.icon,
        contentText: pages.contentText,
      })
      .from(pages)
      .where(
        and(
          eq(pages.workspaceId, ws.id),
          isNull(pages.deletedAt),
          or(ilike(pages.title, term), ilike(pages.contentText, term)),
        ),
      )
      .limit(LIMIT),
    db
      .select({ id: projects.id, name: projects.name, key: projects.key })
      .from(projects)
      .where(
        and(
          eq(projects.workspaceId, ws.id),
          or(ilike(projects.name, term), ilike(projects.key, term)),
        ),
      )
      .limit(LIMIT),
    db
      .select({ id: databases.id, name: databases.name, icon: databases.icon })
      .from(databases)
      .where(and(eq(databases.workspaceId, ws.id), ilike(databases.name, term)))
      .limit(LIMIT),
    db
      .select({ id: cycles.id, name: cycles.name, number: cycles.number })
      .from(cycles)
      .where(and(eq(cycles.workspaceId, ws.id), ilike(cycles.name, term)))
      .limit(LIMIT),
  ]);

  const results: import("@/lib/types").SearchResult[] = [];

  for (const r of issueRows) {
    results.push({
      kind: "issue",
      id: r.id,
      title: r.title,
      subtitle: r.projectKey ? `${r.projectKey}-${r.number}` : `#${r.number}`,
      href: `/issues/${r.id}`,
    });
  }
  for (const r of pageRows) {
    results.push({
      kind: "page",
      id: r.id,
      title: r.title || "Untitled",
      subtitle: snippetAround(r.contentText, q),
      icon: r.icon,
      href: `/pages/${r.id}`,
    });
  }
  for (const r of projectRows) {
    results.push({
      kind: "project",
      id: r.id,
      title: r.name,
      subtitle: r.key,
      href: `/projects/${r.id}`,
    });
  }
  for (const r of databaseRows_) {
    results.push({
      kind: "database",
      id: r.id,
      title: r.name,
      icon: r.icon,
      href: `/databases/${r.id}`,
    });
  }
  for (const r of cycleRows) {
    results.push({
      kind: "cycle",
      id: r.id,
      title: r.name,
      subtitle: `Cycle ${r.number}`,
      href: `/cycles/${r.id}`,
    });
  }

  return results;
}

// ============================================================================
// CRM / Sales / Marketing (the Project × Department matrix)
// ============================================================================

/**
 * Expire the cached reads behind the department surfaces after a matrix
 * mutation. These lists are read together (a deal moving stage changes the
 * project summary, the pipeline and the finance rollup) and the writes are
 * infrequent, so one helper covers the set rather than threading exact
 * entities through forty-odd call sites. The old version was coarser still —
 * it revalidated the whole layout.
 */
function invalidateMatrix(workspaceId: string) {
  invalidate(
    workspaceId,
    "crm",
    "campaigns",
    "finance",
    "tickets",
    "metrics",
    "feedback",
    "projects",
    "status-updates",
  );
}

const toDate = (v?: string | null): Date | null => (v ? new Date(v) : null);

// ---- CRM: accounts ----
export async function createAccount(input: {
  name?: string;
  website?: string | null;
  industry?: string | null;
  type?: string;
  entity?: string;
}) {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const [created] = await db
    .insert(crmAccounts)
    .values({
      workspaceId: ws.id,
      name: input.name?.trim() || "New account",
      website: input.website ?? null,
      industry: input.industry ?? null,
      type: input.type ?? "prospect",
      entity: input.entity ?? "Global",
      ownerId: me.id,
    })
    .returning();
  invalidateMatrix(ws.id);
  return created;
}

export async function updateAccount(
  id: string,
  patch: Partial<{
    name: string;
    website: string | null;
    industry: string | null;
    type: string;
    channel: string;
    pageId: string | null;
    entity: string;
    ownerId: string | null;
  }>,
) {
  const ws = await getWorkspace();
  await db
    .update(crmAccounts)
    .set(patch)
    .where(and(eq(crmAccounts.id, id), eq(crmAccounts.workspaceId, ws.id)));
  invalidateMatrix(ws.id);
}

export async function deleteAccount(id: string) {
  const ws = await getWorkspace();
  await db
    .delete(crmAccounts)
    .where(and(eq(crmAccounts.id, id), eq(crmAccounts.workspaceId, ws.id)));
  invalidateMatrix(ws.id);
}

// ---- CRM: contacts ----
export async function createContact(input: {
  name?: string;
  email?: string | null;
  title?: string | null;
  phone?: string | null;
  accountId?: string | null;
  lifecycleStage?: string;
  source?: string | null;
  entity?: string;
}) {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const [created] = await db
    .insert(crmContacts)
    .values({
      workspaceId: ws.id,
      name: input.name?.trim() || "New contact",
      email: input.email ?? null,
      title: input.title ?? null,
      phone: input.phone ?? null,
      accountId: input.accountId ?? null,
      lifecycleStage: input.lifecycleStage ?? "lead",
      source: input.source ?? null,
      entity: input.entity ?? "Global",
      ownerId: me.id,
    })
    .returning();
  invalidateMatrix(ws.id);
  return created;
}

export async function updateContact(
  id: string,
  patch: Partial<{
    name: string;
    email: string | null;
    title: string | null;
    phone: string | null;
    accountId: string | null;
    lifecycleStage: string;
    source: string | null;
    channel: string;
    referredById: string | null;
    pageId: string | null;
    leadScore: number | null;
    entity: string;
  }>,
) {
  const ws = await getWorkspace();
  await db
    .update(crmContacts)
    .set(patch)
    .where(and(eq(crmContacts.id, id), eq(crmContacts.workspaceId, ws.id)));
  invalidateMatrix(ws.id);
}

export async function deleteContact(id: string) {
  const ws = await getWorkspace();
  await db
    .delete(crmContacts)
    .where(and(eq(crmContacts.id, id), eq(crmContacts.workspaceId, ws.id)));
  invalidateMatrix(ws.id);
}

/**
 * The collateral page for one record — a deck for an account or contact, a
 * brief for a campaign. Returns the page already attached if there is one,
 * otherwise creates it named after the record and links it, so the caller can
 * navigate straight there.
 */
export async function attachCrmPage(
  kind: "account" | "contact" | "campaign",
  id: string,
): Promise<{ pageId: string }> {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const table =
    kind === "account" ? crmAccounts : kind === "contact" ? crmContacts : campaigns;
  const [row] = await db
    .select({ name: table.name, pageId: table.pageId })
    .from(table)
    .where(and(eq(table.id, id), eq(table.workspaceId, ws.id)))
    .limit(1);
  if (!row) throw new Error(`${kind} not found`);
  if (row.pageId) return { pageId: row.pageId };

  // A campaign belongs to a project, so its brief belongs in that project's
  // Docs. Accounts and contacts are workspace-wide, so theirs sit in the wiki.
  let scope: string | null = null;
  if (kind === "campaign") {
    const [c] = await db
      .select({ projectId: campaigns.projectId })
      .from(campaigns)
      .where(eq(campaigns.id, id))
      .limit(1);
    scope = c?.projectId ?? null;
  }

  const [page] = await db
    .insert(pages)
    .values({
      workspaceId: ws.id,
      projectId: scope,
      title: kind === "campaign" ? `${row.name} — brief` : `${row.name} — deck & notes`,
      icon: kind === "account" ? "🏢" : kind === "contact" ? "👤" : "📣",
      creatorId: me.id,
      position: `a${Date.now()}`,
    })
    .returning({ id: pages.id });
  await db
    .update(table)
    .set({ pageId: page.id })
    .where(and(eq(table.id, id), eq(table.workspaceId, ws.id)));
  invalidate(ws.id, "pages");
  invalidateMatrix(ws.id);
  return { pageId: page.id };
}

// ---- Sales: deals ----
export async function createDeal(input: {
  projectId: string | null;
  name?: string;
  accountId?: string | null;
  contactId?: string | null;
  stage?: string;
  value?: number;
  entity?: string;
  expectedClose?: string | null;
}) {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const [created] = await db
    .insert(deals)
    .values({
      workspaceId: ws.id,
      projectId: input.projectId,
      name: input.name?.trim() || "New deal",
      accountId: input.accountId ?? null,
      contactId: input.contactId ?? null,
      stage: input.stage ?? "lead",
      value: input.value ?? 0,
      entity: input.entity ?? "Global",
      expectedClose: toDate(input.expectedClose),
      ownerId: me.id,
      sortKey: `z${Date.now()}`,
    })
    .returning();
  invalidateMatrix(ws.id);
  return created;
}

export async function updateDeal(
  id: string,
  patch: Partial<{
    name: string;
    accountId: string | null;
    contactId: string | null;
    stage: string;
    value: number;
    entity: string;
    ownerId: string | null;
    expectedClose: string | null;
  }>,
) {
  const ws = await getWorkspace();
  const { expectedClose, ...rest } = patch;
  await db
    .update(deals)
    .set({
      ...rest,
      ...(expectedClose !== undefined ? { expectedClose: toDate(expectedClose) } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(deals.id, id), eq(deals.workspaceId, ws.id)));
  invalidateMatrix(ws.id);
}

/** Persist pipeline drag-and-drop: a batch of {id, stage, sortKey}. */
export async function moveDeals(changed: { id: string; stage: string; sortKey: string }[]) {
  const ws = await getWorkspace();
  await Promise.all(
    changed.map((c) =>
      db
        .update(deals)
        .set({ stage: c.stage, sortKey: c.sortKey, updatedAt: new Date() })
        .where(and(eq(deals.id, c.id), eq(deals.workspaceId, ws.id))),
    ),
  );
  invalidateMatrix(ws.id);
}

export async function deleteDeal(id: string) {
  const ws = await getWorkspace();
  await db.delete(deals).where(and(eq(deals.id, id), eq(deals.workspaceId, ws.id)));
  invalidateMatrix(ws.id);
}

// ---- CRM/Sales: activities ----
export async function logActivity(input: {
  type: string;
  body?: string | null;
  accountId?: string | null;
  contactId?: string | null;
  dealId?: string | null;
  projectId?: string | null;
  dueDate?: string | null;
}) {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const [created] = await db
    .insert(crmActivities)
    .values({
      workspaceId: ws.id,
      type: input.type,
      body: input.body ?? null,
      accountId: input.accountId ?? null,
      contactId: input.contactId ?? null,
      dealId: input.dealId ?? null,
      projectId: input.projectId ?? null,
      dueDate: toDate(input.dueDate),
      actorId: me.id,
    })
    .returning();
  invalidateMatrix(ws.id);
  return created;
}

/** Load a deal's activity timeline (newest first) for the deal dialog. */
export async function loadDealActivities(dealId: string) {
  const ws = await getWorkspace();
  return db.query.crmActivities.findMany({
    where: and(
      eq(crmActivities.workspaceId, ws.id),
      eq(crmActivities.dealId, dealId),
    ),
    orderBy: (a, { desc }) => [desc(a.createdAt)],
    with: { actor: true },
  });
}

export async function toggleActivityDone(id: string, done: boolean) {
  const ws = await getWorkspace();
  await db
    .update(crmActivities)
    .set({ done })
    .where(and(eq(crmActivities.id, id), eq(crmActivities.workspaceId, ws.id)));
  invalidateMatrix(ws.id);
}

// ---- Marketing: campaigns ----
export async function createCampaign(input: {
  projectId: string | null;
  name?: string;
  channel?: string;
  status?: string;
  budget?: number;
  reach?: number;
  replies?: number;
  conversions?: number;
  entity?: string;
  startDate?: string | null;
  endDate?: string | null;
}) {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const [created] = await db
    .insert(campaigns)
    .values({
      workspaceId: ws.id,
      projectId: input.projectId,
      name: input.name?.trim() || "New campaign",
      channel: input.channel ?? "email",
      status: input.status ?? "planned",
      budget: input.budget ?? 0,
      reach: input.reach ?? 0,
      replies: input.replies ?? 0,
      conversions: input.conversions ?? 0,
      entity: input.entity ?? "Global",
      startDate: toDate(input.startDate),
      endDate: toDate(input.endDate),
      ownerId: me.id,
    })
    .returning();
  invalidateMatrix(ws.id);
  return created;
}

export async function updateCampaign(
  id: string,
  patch: Partial<{
    name: string;
    channel: string;
    status: string;
    budget: number;
    reach: number;
    replies: number;
    conversions: number;
    pageId: string | null;
    entity: string;
    startDate: string | null;
    endDate: string | null;
  }>,
) {
  const ws = await getWorkspace();
  const { startDate, endDate, ...rest } = patch;
  await db
    .update(campaigns)
    .set({
      ...rest,
      ...(startDate !== undefined ? { startDate: toDate(startDate) } : {}),
      ...(endDate !== undefined ? { endDate: toDate(endDate) } : {}),
    })
    .where(and(eq(campaigns.id, id), eq(campaigns.workspaceId, ws.id)));
  invalidateMatrix(ws.id);
}

export async function deleteCampaign(id: string) {
  const ws = await getWorkspace();
  await db
    .delete(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.workspaceId, ws.id)));
  invalidateMatrix(ws.id);
}

// ---- Marketing: content calendar ----
export async function createContent(input: {
  projectId: string | null;
  title?: string;
  channel?: string | null;
  status?: string;
  campaignId?: string | null;
  url?: string | null;
  notes?: string | null;
  publishDate?: string | null;
}) {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const [created] = await db
    .insert(contentItems)
    .values({
      workspaceId: ws.id,
      projectId: input.projectId,
      title: input.title?.trim() || "Untitled content",
      channel: input.channel ?? null,
      status: input.status ?? "idea",
      campaignId: input.campaignId ?? null,
      url: input.url ?? null,
      notes: input.notes ?? null,
      publishDate: toDate(input.publishDate),
      ownerId: me.id,
    })
    .returning();
  invalidateMatrix(ws.id);
  return created;
}

export async function updateContent(
  id: string,
  patch: Partial<{
    title: string;
    channel: string | null;
    status: string;
    campaignId: string | null;
    url: string | null;
    notes: string | null;
    publishDate: string | null;
  }>,
) {
  const ws = await getWorkspace();
  const { publishDate, ...rest } = patch;
  await db
    .update(contentItems)
    .set({
      ...rest,
      ...(publishDate !== undefined ? { publishDate: toDate(publishDate) } : {}),
    })
    .where(and(eq(contentItems.id, id), eq(contentItems.workspaceId, ws.id)));
  invalidateMatrix(ws.id);
}

export async function deleteContent(id: string) {
  const ws = await getWorkspace();
  await db
    .delete(contentItems)
    .where(and(eq(contentItems.id, id), eq(contentItems.workspaceId, ws.id)));
  invalidateMatrix(ws.id);
}

// ---- Finance: invoices ----
export async function createInvoice(input: {
  projectId: string | null;
  number?: string | null;
  accountId?: string | null;
  status?: string;
  amount?: number;
  entity?: string;
  issueDate?: string | null;
  dueDate?: string | null;
}) {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const [created] = await db
    .insert(invoices)
    .values({
      workspaceId: ws.id,
      projectId: input.projectId,
      number: input.number ?? null,
      accountId: input.accountId ?? null,
      status: input.status ?? "draft",
      amount: input.amount ?? 0,
      entity: input.entity ?? "Global",
      issueDate: toDate(input.issueDate),
      dueDate: toDate(input.dueDate),
      ownerId: me.id,
    })
    .returning();
  invalidateMatrix(ws.id);
  return created;
}

export async function updateInvoice(
  id: string,
  patch: Partial<{
    number: string | null;
    accountId: string | null;
    status: string;
    amount: number;
    entity: string;
    issueDate: string | null;
    dueDate: string | null;
  }>,
) {
  const ws = await getWorkspace();
  const { issueDate, dueDate, ...rest } = patch;
  await db
    .update(invoices)
    .set({
      ...rest,
      ...(issueDate !== undefined ? { issueDate: toDate(issueDate) } : {}),
      ...(dueDate !== undefined ? { dueDate: toDate(dueDate) } : {}),
    })
    .where(and(eq(invoices.id, id), eq(invoices.workspaceId, ws.id)));
  invalidateMatrix(ws.id);
}

export async function deleteInvoice(id: string) {
  const ws = await getWorkspace();
  await db.delete(invoices).where(and(eq(invoices.id, id), eq(invoices.workspaceId, ws.id)));
  invalidateMatrix(ws.id);
}

// ---- Finance: expenses ----
export async function createExpense(input: {
  projectId: string | null;
  vendor?: string | null;
  category?: string;
  amount?: number;
  status?: string;
  entity?: string;
  spentDate?: string | null;
}) {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const [created] = await db
    .insert(expenses)
    .values({
      workspaceId: ws.id,
      projectId: input.projectId,
      vendor: input.vendor ?? null,
      category: input.category ?? "other",
      amount: input.amount ?? 0,
      status: input.status ?? "planned",
      entity: input.entity ?? "Global",
      spentDate: toDate(input.spentDate),
      ownerId: me.id,
    })
    .returning();
  invalidateMatrix(ws.id);
  return created;
}

export async function updateExpense(
  id: string,
  patch: Partial<{
    vendor: string | null;
    category: string;
    amount: number;
    status: string;
    entity: string;
    spentDate: string | null;
  }>,
) {
  const ws = await getWorkspace();
  const { spentDate, ...rest } = patch;
  await db
    .update(expenses)
    .set({
      ...rest,
      ...(spentDate !== undefined ? { spentDate: toDate(spentDate) } : {}),
    })
    .where(and(eq(expenses.id, id), eq(expenses.workspaceId, ws.id)));
  invalidateMatrix(ws.id);
}

export async function deleteExpense(id: string) {
  const ws = await getWorkspace();
  await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.workspaceId, ws.id)));
  invalidateMatrix(ws.id);
}

// ---- Support: tickets ----
export async function createTicket(input: {
  projectId: string | null;
  subject?: string;
  body?: string | null;
  status?: string;
  priority?: string;
  accountId?: string | null;
  contactId?: string | null;
  assigneeId?: string | null;
  requesterEmail?: string | null;
  entity?: string;
}) {
  const ws = await getWorkspace();
  const [created] = await db
    .insert(tickets)
    .values({
      workspaceId: ws.id,
      projectId: input.projectId,
      subject: input.subject?.trim() || "New ticket",
      body: input.body ?? null,
      status: input.status ?? "open",
      priority: input.priority ?? "normal",
      accountId: input.accountId ?? null,
      contactId: input.contactId ?? null,
      assigneeId: input.assigneeId ?? null,
      requesterEmail: input.requesterEmail ?? null,
      entity: input.entity ?? "Global",
      sortKey: `z${Date.now()}`,
    })
    .returning();
  invalidateMatrix(ws.id);
  return created;
}

export async function updateTicket(
  id: string,
  patch: Partial<{
    subject: string;
    body: string | null;
    status: string;
    priority: string;
    accountId: string | null;
    contactId: string | null;
    assigneeId: string | null;
    requesterEmail: string | null;
    entity: string;
  }>,
) {
  const ws = await getWorkspace();
  await db
    .update(tickets)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(tickets.id, id), eq(tickets.workspaceId, ws.id)));
  invalidateMatrix(ws.id);
}

// ---- Features department ----

export async function createFeature(input: {
  projectId: string | null;
  title?: string;
  status?: string;
}) {
  const ws = await getWorkspace();
  const [created] = await db
    .insert(features)
    .values({
      workspaceId: ws.id,
      projectId: input.projectId,
      title: input.title?.trim() || "New feature",
      status: input.status ?? "idea",
      sortKey: `z${Date.now()}`,
    })
    .returning();
  invalidateMatrix(ws.id);
  return created;
}

export async function updateFeature(
  id: string,
  patch: Partial<{
    title: string;
    status: string;
    startDate: Date | null;
    targetDate: Date | null;
    spec: unknown;
    pageId: string | null;
    ownerId: string | null;
    milestoneId: string | null;
  }>,
) {
  const ws = await getWorkspace();
  await db
    .update(features)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(features.id, id), eq(features.workspaceId, ws.id)));
  invalidateMatrix(ws.id);
}

// ---- Milestones (project phases) ----

export async function createMilestone(input: {
  projectId: string;
  name?: string;
  targetDate?: string | null;
}) {
  const ws = await getWorkspace();
  const [created] = await db
    .insert(milestones)
    .values({
      workspaceId: ws.id,
      projectId: input.projectId,
      name: input.name?.trim() || "New milestone",
      targetDate: input.targetDate ? new Date(input.targetDate) : null,
      sortKey: `m${Date.now()}`,
    })
    .returning();
  invalidateMatrix(ws.id);
  return created;
}

export async function updateMilestone(
  id: string,
  patch: Partial<{
    name: string;
    description: string | null;
    targetDate: string | null;
    status: string;
  }>,
) {
  const ws = await getWorkspace();
  const values: Record<string, unknown> = {};
  if (patch.name !== undefined) values.name = patch.name.trim() || "Untitled milestone";
  if (patch.description !== undefined) values.description = patch.description;
  if (patch.targetDate !== undefined)
    values.targetDate = patch.targetDate ? new Date(patch.targetDate) : null;
  if (patch.status !== undefined && isMilestoneStatus(patch.status)) values.status = patch.status;
  await db
    .update(milestones)
    .set(values)
    .where(and(eq(milestones.id, id), eq(milestones.workspaceId, ws.id)));
  invalidateMatrix(ws.id);
}

export async function deleteMilestone(id: string) {
  const ws = await getWorkspace();
  // Features keep existing; their milestone_id is cleared (FK ON DELETE SET NULL).
  await db
    .delete(milestones)
    .where(and(eq(milestones.id, id), eq(milestones.workspaceId, ws.id)));
  invalidateMatrix(ws.id);
}

// ---- Company-level: quarterly "bets" shown on the Overview home ----
export async function updateCompanyBets(bets: string[]) {
  const ws = await getWorkspace();
  const cleaned = bets.map((b) => b.trim()).filter(Boolean).slice(0, 5);
  await db.update(workspaces).set({ bets: cleaned }).where(eq(workspaces.id, ws.id));
  refresh();
}

/** Link (or unlink) an issue to a feature. */
export async function linkIssueToFeature(issueId: string, featureId: string | null) {
  const ws = await getWorkspace();
  await db
    .update(issues)
    .set({ featureId, updatedAt: new Date() })
    .where(and(eq(issues.id, issueId), eq(issues.workspaceId, ws.id)));
  invalidateMatrix(ws.id);
}

// ---- Analytics: metrics + points ----
export async function createMetric(input: {
  projectId: string | null;
  name?: string;
  unit?: string | null;
  cadence?: string;
  isNorthStar?: boolean;
}) {
  const ws = await getWorkspace();
  const [created] = await db
    .insert(metrics)
    .values({
      workspaceId: ws.id,
      projectId: input.projectId,
      name: input.name?.trim() || "New metric",
      unit: input.unit ?? null,
      cadence: input.cadence ?? "monthly",
      isNorthStar: input.isNorthStar ?? false,
      sortKey: `z${Date.now()}`,
    })
    .returning();
  invalidateMatrix(ws.id);
  return created;
}

export async function updateMetric(
  id: string,
  patch: Partial<{
    name: string;
    unit: string | null;
    cadence: string;
    target: number | null;
    targetDirection: string;
    isNorthStar: boolean;
  }>,
) {
  const ws = await getWorkspace();
  await db.update(metrics).set(patch).where(and(eq(metrics.id, id), eq(metrics.workspaceId, ws.id)));
  invalidateMatrix(ws.id);
}

export async function deleteMetric(id: string) {
  const ws = await getWorkspace();
  await db.delete(metrics).where(and(eq(metrics.id, id), eq(metrics.workspaceId, ws.id)));
  invalidateMatrix(ws.id);
}

/** Record (or overwrite) a metric value for a period. */
export async function addMetricPoint(input: {
  metricId: string;
  periodDate: string;
  value: number;
}) {
  const ws = await getWorkspace();
  // Guard: the metric must belong to this workspace.
  const owner = await db.query.metrics.findFirst({
    where: and(eq(metrics.id, input.metricId), eq(metrics.workspaceId, ws.id)),
    columns: { id: true },
  });
  if (!owner) return;
  const date = new Date(input.periodDate);
  // One point per period: replace an existing same-date point.
  const existing = await db.query.metricPoints.findFirst({
    where: and(eq(metricPoints.metricId, input.metricId), eq(metricPoints.periodDate, date)),
    columns: { id: true },
  });
  if (existing) {
    await db.update(metricPoints).set({ value: input.value }).where(eq(metricPoints.id, existing.id));
  } else {
    await db.insert(metricPoints).values({ metricId: input.metricId, periodDate: date, value: input.value });
  }
  invalidateMatrix(ws.id);
}

export async function deleteMetricPoint(id: string) {
  const ws = await getWorkspace();
  await db.delete(metricPoints).where(eq(metricPoints.id, id));
  invalidateMatrix(ws.id);
}

// ---- Product: feedback (discovery) ----
export async function createFeedback(input: {
  projectId: string | null;
  title?: string;
  source?: string;
  status?: string;
}) {
  const ws = await getWorkspace();
  const [created] = await db
    .insert(feedback)
    .values({
      workspaceId: ws.id,
      projectId: input.projectId,
      title: input.title?.trim() || "New feedback",
      source: input.source ?? "customer",
      status: input.status ?? "new",
      sortKey: `z${Date.now()}`,
    })
    .returning();
  invalidateMatrix(ws.id);
  return created;
}

export async function updateFeedback(
  id: string,
  patch: Partial<{
    title: string;
    body: string | null;
    source: string;
    status: string;
    votes: number;
    contact: string | null;
    featureId: string | null;
  }>,
) {
  const ws = await getWorkspace();
  await db
    .update(feedback)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(feedback.id, id), eq(feedback.workspaceId, ws.id)));
  invalidateMatrix(ws.id);
}

export async function deleteFeedback(id: string) {
  const ws = await getWorkspace();
  await db.delete(feedback).where(and(eq(feedback.id, id), eq(feedback.workspaceId, ws.id)));
  invalidateMatrix(ws.id);
}

/** Persist ticket board drag-and-drop: a batch of {id, status, sortKey}. */
export async function moveTickets(changed: { id: string; status: string; sortKey: string }[]) {
  const ws = await getWorkspace();
  await Promise.all(
    changed.map((c) =>
      db
        .update(tickets)
        .set({ status: c.status, sortKey: c.sortKey, updatedAt: new Date() })
        .where(and(eq(tickets.id, c.id), eq(tickets.workspaceId, ws.id))),
    ),
  );
  invalidateMatrix(ws.id);
}

export async function deleteTicket(id: string) {
  const ws = await getWorkspace();
  await db.delete(tickets).where(and(eq(tickets.id, id), eq(tickets.workspaceId, ws.id)));
  invalidateMatrix(ws.id);
}

export async function loadTicketComments(ticketId: string) {
  const ws = await getWorkspace();
  return db.query.ticketComments.findMany({
    where: and(
      eq(ticketComments.workspaceId, ws.id),
      eq(ticketComments.ticketId, ticketId),
    ),
    orderBy: (c, { asc }) => [asc(c.createdAt)],
    with: { author: true },
  });
}

export async function addTicketComment(ticketId: string, body: string) {
  const text = body?.trim();
  if (!text) return;
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  await db.insert(ticketComments).values({
    workspaceId: ws.id,
    ticketId,
    authorId: me.id,
    body: text,
  });
  await db
    .update(tickets)
    .set({ updatedAt: new Date() })
    .where(and(eq(tickets.id, ticketId), eq(tickets.workspaceId, ws.id)));
}

// ---- Editor: link preview (bookmark cards) ----

export type LinkPreview = {
  url: string;
  title: string;
  description: string;
  image: string | null;
  favicon: string;
  domain: string;
};

const PRIVATE_HOST =
  /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?)/i;

/** Fetch Open Graph metadata for a URL to render a Notion-style bookmark card. */
export async function getLinkPreview(rawUrl: string): Promise<LinkPreview> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Unsupported URL");
  if (PRIVATE_HOST.test(u.hostname)) throw new Error("Refusing to fetch a private address");

  const domain = u.hostname.replace(/^www\./, "");
  const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

  let html = "";
  try {
    const res = await fetch(u.toString(), {
      headers: { "user-agent": "Mozilla/5.0 (compatible; GnanalyticaBot/1.0)" },
      signal: AbortSignal.timeout(6000),
    });
    html = (await res.text()).slice(0, 500_000);
  } catch {
    // Fall through to a minimal preview from the URL itself.
  }

  const meta = (key: string): string | null => {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']*)["']`,
      "i",
    );
    const alt = new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${key}["']`,
      "i",
    );
    return (html.match(re)?.[1] ?? html.match(alt)?.[1] ?? null);
  };
  const decode = (s: string) =>
    s
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

  const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? null;
  const title = decode(meta("og:title") || titleTag || domain).slice(0, 200);
  const description = decode(meta("og:description") || meta("description") || "").slice(0, 300);
  const image = meta("og:image");

  return { url: u.toString(), title, description, image, favicon, domain };
}
