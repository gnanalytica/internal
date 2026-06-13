"use server";

import { and, eq, ilike, isNull, max, or } from "drizzle-orm";
import { del, put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { db } from "@/db";
import {
  activity,
  attachments,
  comments,
  cycles,
  databaseFields,
  databaseRows,
  databases,
  initiatives,
  issueLabels,
  issuePageLinks,
  issues,
  notifications,
  pages,
  projects,
  teamMembers,
  teams,
  users,
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
import { findMentionedMemberIds } from "@/lib/mentions";
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

  revalidatePath("/issues");
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

  revalidatePath(`/issues/${issueId}`);
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
  if (patch.description !== undefined) values.description = patch.description;
  if (patch.status !== undefined && isStatus(patch.status)) values.status = patch.status;
  if (patch.priority !== undefined && isPriority(patch.priority))
    values.priority = patch.priority;
  if (patch.assigneeId !== undefined) values.assigneeId = patch.assigneeId;
  if (patch.projectId !== undefined) values.projectId = patch.projectId;
  if (patch.cycleId !== undefined) values.cycleId = patch.cycleId;
  if (patch.teamId !== undefined) values.teamId = patch.teamId;
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
  revalidatePath("/projects");
  revalidatePath("/", "layout");
  return created;
}

export async function updateProject(
  id: string,
  patch: Partial<{ name: string; description: string; color: string }>,
) {
  const ws = await getWorkspace();
  const values: Record<string, unknown> = {};
  if (patch.name !== undefined) values.name = patch.name.trim() || "Untitled project";
  if (patch.description !== undefined) values.description = patch.description;
  if (patch.color !== undefined) values.color = patch.color;
  if (Object.keys(values).length === 0) return;
  await db
    .update(projects)
    .set(values)
    .where(and(eq(projects.workspaceId, ws.id), eq(projects.id, id)));
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  revalidatePath("/", "layout");
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
  input: { name: string; type: string },
) {
  await db.insert(databaseFields).values({
    databaseId,
    name: input.name.trim() || "Field",
    type: input.type,
    position: `a${Date.now()}`,
    options:
      input.type === "select"
        ? [{ label: "Option 1", color: "#6366f1" }]
        : null,
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
      .select({ id: pages.id, title: pages.title, icon: pages.icon })
      .from(pages)
      .where(and(eq(pages.workspaceId, ws.id), ilike(pages.title, term)))
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
