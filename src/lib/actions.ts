"use server";

import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { db } from "@/db";
import {
  activity,
  comments,
  cycles,
  databaseFields,
  databaseRows,
  databases,
  initiatives,
  issueLabels,
  issuePageLinks,
  issues,
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
  getMyRole,
  getWorkspace,
  pickColor,
} from "@/lib/data";
import { isPriority, isStatus } from "@/lib/constants";
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
