"use server";

import { and, eq, ilike, inArray, isNull, max, or } from "drizzle-orm";
import { del, put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
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
  initiatives,
  invoices,
  issueLabels,
  issuePageLinks,
  issueRelations,
  issues,
  notifications,
  projectStatusUpdates,
  references,
  savedViews,
  pages,
  projects,
  teamMembers,
  teams,
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
import { isPriority, isStatus } from "@/lib/constants";
import { callClaude, isAiConfigured } from "@/lib/ai";
import { extractJsonArray, normalizeProposedIssue } from "@/lib/ai-parse";
import { generateApiKey } from "@/lib/api/keys";
import {
  WEBHOOK_EVENTS,
  dispatchWebhook,
  newWebhookSecret,
} from "@/lib/api/webhooks";
import { findMentionedMemberIds } from "@/lib/mentions";
import { isRelationType } from "@/lib/issue-relations";
import { extractReferences } from "@/lib/references";
import { snippetAround } from "@/lib/snippet";

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
  revalidatePath("/settings/slack");
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
  revalidatePath("/", "layout");
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
  revalidatePath("/", "layout");
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
  revalidatePath("/members");
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
  revalidatePath("/members");
}

export async function removeMember(userId: string) {
  const ws = await getWorkspace();
  await requireAdmin(ws.id);
  const me = await getCurrentUser(ws.id);
  if (userId === me.id) throw new Error("You can't remove yourself.");
  await ensureNotLastAdmin(ws.id, userId);
  await db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, ws.id),
        eq(workspaceMembers.userId, userId),
      ),
    );
  revalidatePath("/members");
}

// ---- Issues ----

export async function createIssue(input: {
  title: string;
  projectId?: string | null;
  status?: string;
  priority?: string;
  assigneeId?: string | null;
  parentId?: string | null;
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
      number: (maxNumber ?? 0) + 1,
      title: input.title.trim() || "Untitled issue",
      status: input.status && isStatus(input.status) ? input.status : "backlog",
      priority: input.priority && isPriority(input.priority) ? input.priority : "none",
      assigneeId: input.assigneeId ?? null,
      creatorId: me.id,
      sortKey: `a${Date.now()}`,
    })
    .returning();

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

  revalidatePath("/issues");
  if (created.parentId) revalidatePath(`/issues/${created.parentId}`);
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
    const mentioned = new Set(
      findMentionedMemberIds(text, members).filter((uid) => uid !== me.id),
    );
    const commented = new Set(
      [issue.assigneeId, issue.creatorId].filter(
        (uid): uid is string => uid != null && uid !== me.id && !mentioned.has(uid),
      ),
    );

    const rows = [
      ...[...mentioned].map((userId) => ({
        workspaceId: ws.id,
        userId,
        actorId: me.id,
        type: "mentioned",
        issueId,
        title: `${me.name} mentioned you on ${issue.title}`,
        body: text.slice(0, 140),
      })),
      ...[...commented].map((userId) => ({
        workspaceId: ws.id,
        userId,
        actorId: me.id,
        type: "commented",
        issueId,
        title: `${me.name} commented on ${issue.title}`,
        body: text.slice(0, 140),
      })),
    ];
    if (rows.length) await db.insert(notifications).values(rows);
  }

  await dispatchWebhook(ws.id, "issue.commented", { issueId, body: text });

  revalidatePath(`/issues/${issueId}`);
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
  revalidatePath(`/issues/${c.issueId}`);
}

export async function deleteComment(id: string, issueId: string) {
  const ws = await getWorkspace();
  await db
    .delete(comments)
    .where(and(eq(comments.workspaceId, ws.id), eq(comments.id, id)));
  revalidatePath(`/issues/${issueId}`);
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
    teamId: string | null;
    parentId: string | null;
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
  if (patch.assigneeId !== undefined) values.assigneeId = patch.assigneeId;
  if (patch.projectId !== undefined) values.projectId = patch.projectId;
  if (patch.cycleId !== undefined) values.cycleId = patch.cycleId;
  if (patch.teamId !== undefined) values.teamId = patch.teamId;
  if (patch.parentId !== undefined) values.parentId = patch.parentId;
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

    // Notify the new assignee (when it's someone other than the actor).
    if (
      patch.assigneeId !== undefined &&
      patch.assigneeId &&
      patch.assigneeId !== before.assigneeId &&
      patch.assigneeId !== me.id
    ) {
      await db.insert(notifications).values({
        workspaceId: ws.id,
        userId: patch.assigneeId,
        actorId: me.id,
        type: "assigned",
        issueId: id,
        title: `${me.name} assigned you an issue`,
        body: patch.title ?? before.title,
      });
    }
  }

  const { description: _omitDesc, ...changed } = patch;
  void _omitDesc;
  await dispatchWebhook(ws.id, "issue.updated", { id, ...changed });

  revalidatePath("/issues");
  revalidatePath(`/issues/${id}`);
}

export async function deleteIssue(id: string) {
  const ws = await getWorkspace();
  await db.delete(issues).where(and(eq(issues.workspaceId, ws.id), eq(issues.id, id)));
  await dispatchWebhook(ws.id, "issue.deleted", { id });
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
  await dispatchWebhook(ws.id, "page.created", { id: created.id, title: created.title });
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
  if (patch.content !== undefined) {
    values.content = patch.content;
    values.contentText = docToText(patch.content).slice(0, 20000);
    await syncReferences(ws.id, "page", id, patch.content);
  }

  await db
    .update(pages)
    .set(values)
    .where(and(eq(pages.workspaceId, ws.id), eq(pages.id, id)));

  revalidatePath("/", "layout");
  revalidatePath(`/pages/${id}`);
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
  revalidatePath("/", "layout");
  revalidatePath("/trash");
}

export async function restorePage(id: string) {
  const ws = await getWorkspace();
  await db
    .update(pages)
    .set({ deletedAt: null })
    .where(and(eq(pages.workspaceId, ws.id), eq(pages.id, id)));
  revalidatePath("/", "layout");
  revalidatePath("/trash");
}

/** Permanently delete a trashed page. */
export async function deletePageForever(id: string) {
  const ws = await getWorkspace();
  await db.delete(pages).where(and(eq(pages.workspaceId, ws.id), eq(pages.id, id)));
  revalidatePath("/trash");
  revalidatePath("/", "layout");
}

// ---- Issue relations ----

export async function addIssueRelation(
  issueId: string,
  relatedIssueId: string,
  type: string,
) {
  if (issueId === relatedIssueId) throw new Error("An issue can't relate to itself.");
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
  revalidatePath(`/issues/${issueId}`);
  revalidatePath(`/issues/${relatedIssueId}`);
}

export async function removeIssueRelation(relationId: string, issueId: string) {
  const ws = await getWorkspace();
  await db
    .delete(issueRelations)
    .where(and(eq(issueRelations.workspaceId, ws.id), eq(issueRelations.id, relationId)));
  revalidatePath(`/issues/${issueId}`);
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
  await requireAdmin(ws.id);
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

const PROJECT_COLORS = [
  "#6366f1", "#ec4899", "#10b981", "#f59e0b", "#3b82f6",
  "#a855f7", "#ef4444", "#14b8a6", "#f97316", "#8b5cf6",
];

/** Create a project, deriving a unique key prefix from its name. */
export async function createProject(input: { name: string; key?: string }) {
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
    })
    .returning();
  await dispatchWebhook(ws.id, "project.created", {
    id: created.id,
    name: created.name,
    key: created.key,
  });
  revalidatePath("/projects");
  revalidatePath("/", "layout");
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
  }>,
) {
  const ws = await getWorkspace();
  const values: Record<string, unknown> = {};
  if (patch.name !== undefined) values.name = patch.name.trim() || "Untitled project";
  if (patch.description !== undefined) values.description = patch.description;
  if (patch.color !== undefined) values.color = patch.color;
  if (patch.startDate !== undefined)
    values.startDate = patch.startDate ? new Date(patch.startDate) : null;
  if (patch.targetDate !== undefined)
    values.targetDate = patch.targetDate ? new Date(patch.targetDate) : null;
  if (Object.keys(values).length === 0) return;
  await db
    .update(projects)
    .set(values)
    .where(and(eq(projects.workspaceId, ws.id), eq(projects.id, id)));
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  revalidatePath("/roadmap");
  revalidatePath("/", "layout");
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
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteStatusUpdate(id: string, projectId: string) {
  const ws = await getWorkspace();
  await db
    .delete(projectStatusUpdates)
    .where(
      and(
        eq(projectStatusUpdates.workspaceId, ws.id),
        eq(projectStatusUpdates.id, id),
      ),
    );
  revalidatePath(`/projects/${projectId}`);
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
  revalidatePath("/projects");
  revalidatePath("/", "layout");
}

// ---- Teams ----

export async function createTeam(input: { name: string; key?: string }) {
  const ws = await getWorkspace();
  const me = await getCurrentUser();
  const name = input.name.trim() || "New team";
  const key =
    (input.key?.trim() || name.slice(0, 4))
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 5) || "TEAM";
  const [team] = await db
    .insert(teams)
    .values({ workspaceId: ws.id, name, key })
    .returning();
  await db
    .insert(teamMembers)
    .values({ teamId: team.id, userId: me.id })
    .onConflictDoNothing();
  revalidatePath("/teams");
  return team;
}

export async function updateTeam(
  id: string,
  patch: Partial<{ name: string; key: string; color: string; icon: string }>,
) {
  const ws = await getWorkspace();
  await db
    .update(teams)
    .set(patch)
    .where(and(eq(teams.workspaceId, ws.id), eq(teams.id, id)));
  revalidatePath("/teams");
  revalidatePath(`/teams/${id}`);
}

export async function deleteTeam(id: string) {
  const ws = await getWorkspace();
  await requireAdmin(ws.id);
  await db.delete(teams).where(and(eq(teams.workspaceId, ws.id), eq(teams.id, id)));
  revalidatePath("/teams");
}

export async function addTeamMember(teamId: string, userId: string) {
  await db.insert(teamMembers).values({ teamId, userId }).onConflictDoNothing();
  revalidatePath(`/teams/${teamId}`);
}

export async function removeTeamMember(teamId: string, userId: string) {
  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
  revalidatePath(`/teams/${teamId}`);
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
  revalidatePath("/databases");
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
  revalidatePath("/databases");
  revalidatePath(`/databases/${id}`);
}

export async function deleteDatabase(id: string) {
  const ws = await getWorkspace();
  await requireAdmin(ws.id);
  await db
    .delete(databases)
    .where(and(eq(databases.workspaceId, ws.id), eq(databases.id, id)));
  revalidatePath("/databases");
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
  revalidatePath(`/databases/${databaseId}`);
}

export async function updateField(
  id: string,
  databaseId: string,
  patch: Partial<{ name: string; type: string; options: unknown }>,
) {
  await db.update(databaseFields).set(patch).where(eq(databaseFields.id, id));
  revalidatePath(`/databases/${databaseId}`);
}

export async function deleteField(id: string, databaseId: string) {
  await db.delete(databaseFields).where(eq(databaseFields.id, id));
  revalidatePath(`/databases/${databaseId}`);
}

export async function addRow(databaseId: string) {
  await db
    .insert(databaseRows)
    .values({ databaseId, values: {}, position: `a${Date.now()}` });
  revalidatePath(`/databases/${databaseId}`);
}

export async function updateCell(
  rowId: string,
  databaseId: string,
  fieldId: string,
  value: unknown,
) {
  const [row] = await db
    .select({ values: databaseRows.values })
    .from(databaseRows)
    .where(eq(databaseRows.id, rowId))
    .limit(1);
  const next = { ...((row?.values as Record<string, unknown>) ?? {}), [fieldId]: value };
  await db.update(databaseRows).set({ values: next }).where(eq(databaseRows.id, rowId));
  revalidatePath(`/databases/${databaseId}`);
}

export async function deleteRow(id: string, databaseId: string) {
  await db.delete(databaseRows).where(eq(databaseRows.id, id));
  revalidatePath(`/databases/${databaseId}`);
}

// ---- GitHub issue sync ----

function docToText(doc: unknown): string {
  if (!doc || typeof doc !== "object") return "";
  const node = doc as { type?: string; text?: string; content?: unknown[] };
  if (typeof node.text === "string") return node.text;
  if (Array.isArray(node.content)) {
    const sep = node.type === "doc" || node.type === "bulletList" || node.type === "orderedList" ? "\n" : "";
    return node.content.map(docToText).join(sep);
  }
  return "";
}

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
  revalidatePath("/settings/github");
}

export async function disconnectGithub() {
  const ws = await getWorkspace();
  await requireAdmin(ws.id);
  await db
    .update(workspaces)
    .set({ githubRepo: null, githubToken: null })
    .where(eq(workspaces.id, ws.id));
  revalidatePath("/settings/github");
}

/** Push an internal issue to GitHub and link it back. */
export async function pushIssueToGithub(issueId: string) {
  const ws = await getWorkspace();
  const [issue] = await db
    .select()
    .from(issues)
    .where(and(eq(issues.workspaceId, ws.id), eq(issues.id, issueId)))
    .limit(1);
  if (!issue) throw new Error("Issue not found.");
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
  revalidatePath(`/issues/${issueId}`);
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
  if (!issue) throw new Error("Issue not found.");

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

  revalidatePath(`/issues/${issueId}`);
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
  revalidatePath(`/issues/${issueId}`);
}

// ---- Favorites ----

const FAVORITE_KINDS = new Set(["issue", "page", "project"]);

/** Toggle a favorite for the current user; returns the new favorited state. */
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
  revalidatePath("/", "layout");
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
  revalidatePath("/inbox");
  revalidatePath("/", "layout");
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
  revalidatePath("/inbox");
  revalidatePath("/", "layout");
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

  revalidatePath(`/pages/${pageId}`);
  revalidatePath("/issues");
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
  revalidatePath("/settings/api");
  return { key, prefix };
}

export async function revokeApiKey(id: string) {
  const ws = await getWorkspace();
  await requireAdmin(ws.id);
  await db.delete(apiKeys).where(and(eq(apiKeys.workspaceId, ws.id), eq(apiKeys.id, id)));
  revalidatePath("/settings/api");
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
  revalidatePath("/settings/api");
  return { secret };
}

export async function setWebhookActive(id: string, active: boolean) {
  const ws = await getWorkspace();
  await requireAdmin(ws.id);
  await db
    .update(webhooks)
    .set({ active })
    .where(and(eq(webhooks.workspaceId, ws.id), eq(webhooks.id, id)));
  revalidatePath("/settings/api");
}

export async function deleteWebhook(id: string) {
  const ws = await getWorkspace();
  await requireAdmin(ws.id);
  await db.delete(webhooks).where(and(eq(webhooks.workspaceId, ws.id), eq(webhooks.id, id)));
  revalidatePath("/settings/api");
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
  revalidatePath("/issues");
  return { id: created.id, name: created.name };
}

export async function deleteSavedView(id: string) {
  const ws = await getWorkspace();
  await db
    .delete(savedViews)
    .where(and(eq(savedViews.workspaceId, ws.id), eq(savedViews.id, id)));
  revalidatePath("/issues");
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
    initiativeRows,
    databaseRows_,
    teamRows,
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
      .select({ id: initiatives.id, name: initiatives.name })
      .from(initiatives)
      .where(and(eq(initiatives.workspaceId, ws.id), ilike(initiatives.name, term)))
      .limit(LIMIT),
    db
      .select({ id: databases.id, name: databases.name, icon: databases.icon })
      .from(databases)
      .where(and(eq(databases.workspaceId, ws.id), ilike(databases.name, term)))
      .limit(LIMIT),
    db
      .select({ id: teams.id, name: teams.name, key: teams.key, icon: teams.icon })
      .from(teams)
      .where(
        and(
          eq(teams.workspaceId, ws.id),
          or(ilike(teams.name, term), ilike(teams.key, term)),
        ),
      )
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
  for (const r of initiativeRows) {
    results.push({
      kind: "initiative",
      id: r.id,
      title: r.name,
      href: `/initiatives/${r.id}`,
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
  for (const r of teamRows) {
    results.push({
      kind: "team",
      id: r.id,
      title: r.name,
      subtitle: r.key,
      icon: r.icon,
      href: `/teams/${r.id}`,
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
// CRM / Sales / Marketing (the Product × Department matrix)
// ============================================================================

/** Revalidate both lenses (product-scoped + company-wide) after a mutation. */
function revalidateMatrix(productId?: string | null) {
  revalidatePath("/sales");
  revalidatePath("/marketing");
  revalidatePath("/finance");
  revalidatePath("/products");
  if (productId) revalidatePath(`/products/${productId}`, "layout");
  revalidatePath("/", "layout");
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
  revalidateMatrix();
  return created;
}

export async function updateAccount(
  id: string,
  patch: Partial<{
    name: string;
    website: string | null;
    industry: string | null;
    type: string;
    entity: string;
    ownerId: string | null;
  }>,
) {
  const ws = await getWorkspace();
  await db
    .update(crmAccounts)
    .set(patch)
    .where(and(eq(crmAccounts.id, id), eq(crmAccounts.workspaceId, ws.id)));
  revalidateMatrix();
}

export async function deleteAccount(id: string) {
  const ws = await getWorkspace();
  await db
    .delete(crmAccounts)
    .where(and(eq(crmAccounts.id, id), eq(crmAccounts.workspaceId, ws.id)));
  revalidateMatrix();
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
  revalidateMatrix();
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
    entity: string;
  }>,
) {
  const ws = await getWorkspace();
  await db
    .update(crmContacts)
    .set(patch)
    .where(and(eq(crmContacts.id, id), eq(crmContacts.workspaceId, ws.id)));
  revalidateMatrix();
}

export async function deleteContact(id: string) {
  const ws = await getWorkspace();
  await db
    .delete(crmContacts)
    .where(and(eq(crmContacts.id, id), eq(crmContacts.workspaceId, ws.id)));
  revalidateMatrix();
}

// ---- Sales: deals ----
export async function createDeal(input: {
  productId: string | null;
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
      productId: input.productId,
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
  revalidateMatrix(input.productId);
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
  revalidateMatrix();
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
  revalidateMatrix();
}

export async function deleteDeal(id: string) {
  const ws = await getWorkspace();
  await db.delete(deals).where(and(eq(deals.id, id), eq(deals.workspaceId, ws.id)));
  revalidateMatrix();
}

// ---- CRM/Sales: activities ----
export async function logActivity(input: {
  type: string;
  body?: string | null;
  accountId?: string | null;
  contactId?: string | null;
  dealId?: string | null;
  productId?: string | null;
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
      productId: input.productId ?? null,
      dueDate: toDate(input.dueDate),
      actorId: me.id,
    })
    .returning();
  revalidateMatrix(input.productId);
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
  revalidateMatrix();
}

// ---- Marketing: campaigns ----
export async function createCampaign(input: {
  productId: string | null;
  name?: string;
  channel?: string;
  status?: string;
  budget?: number;
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
      productId: input.productId,
      name: input.name?.trim() || "New campaign",
      channel: input.channel ?? "email",
      status: input.status ?? "planned",
      budget: input.budget ?? 0,
      entity: input.entity ?? "Global",
      startDate: toDate(input.startDate),
      endDate: toDate(input.endDate),
      ownerId: me.id,
    })
    .returning();
  revalidateMatrix(input.productId);
  return created;
}

export async function updateCampaign(
  id: string,
  patch: Partial<{
    name: string;
    channel: string;
    status: string;
    budget: number;
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
  revalidateMatrix();
}

export async function deleteCampaign(id: string) {
  const ws = await getWorkspace();
  await db
    .delete(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.workspaceId, ws.id)));
  revalidateMatrix();
}

// ---- Marketing: content calendar ----
export async function createContent(input: {
  productId: string | null;
  title?: string;
  channel?: string | null;
  status?: string;
  campaignId?: string | null;
  publishDate?: string | null;
}) {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const [created] = await db
    .insert(contentItems)
    .values({
      workspaceId: ws.id,
      productId: input.productId,
      title: input.title?.trim() || "Untitled content",
      channel: input.channel ?? null,
      status: input.status ?? "idea",
      campaignId: input.campaignId ?? null,
      publishDate: toDate(input.publishDate),
      ownerId: me.id,
    })
    .returning();
  revalidateMatrix(input.productId);
  return created;
}

export async function updateContent(
  id: string,
  patch: Partial<{
    title: string;
    channel: string | null;
    status: string;
    campaignId: string | null;
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
  revalidateMatrix();
}

export async function deleteContent(id: string) {
  const ws = await getWorkspace();
  await db
    .delete(contentItems)
    .where(and(eq(contentItems.id, id), eq(contentItems.workspaceId, ws.id)));
  revalidateMatrix();
}

// ---- Finance: invoices ----
export async function createInvoice(input: {
  productId: string | null;
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
      productId: input.productId,
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
  revalidateMatrix(input.productId);
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
  revalidateMatrix();
}

export async function deleteInvoice(id: string) {
  const ws = await getWorkspace();
  await db.delete(invoices).where(and(eq(invoices.id, id), eq(invoices.workspaceId, ws.id)));
  revalidateMatrix();
}

// ---- Finance: expenses ----
export async function createExpense(input: {
  productId: string | null;
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
      productId: input.productId,
      vendor: input.vendor ?? null,
      category: input.category ?? "other",
      amount: input.amount ?? 0,
      status: input.status ?? "planned",
      entity: input.entity ?? "Global",
      spentDate: toDate(input.spentDate),
      ownerId: me.id,
    })
    .returning();
  revalidateMatrix(input.productId);
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
  revalidateMatrix();
}

export async function deleteExpense(id: string) {
  const ws = await getWorkspace();
  await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.workspaceId, ws.id)));
  revalidateMatrix();
}
