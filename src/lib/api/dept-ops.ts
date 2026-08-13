import "server-only";

import { and, asc, eq, max } from "drizzle-orm";

import { db } from "@/db";
import {
  contentItems,
  crmActivities,
  databaseFields,
  databaseRows,
  databases,
  feedback,
  metricPoints,
  metrics,
  orgRoles,
  projectStatusUpdates,
  users,
  workspaceMembers,
} from "@/db/schema";
import { pickColor } from "@/lib/data";

/**
 * Create helpers for the department surfaces that had no API: analytics
 * (metrics), product (feedback), marketing (content), people (org chart +
 * members), the weekly review (status updates), CRM activity logging, and the
 * Notion-style databases.
 *
 * Editing and deleting these go through the shared registry in `records.ts`;
 * only the shapes that need extra work (nested rows, join tables, upserts)
 * live here.
 */

const toDate = (v?: string | null): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error("Expected an ISO date.");
  return d;
};

const req = (v: string | undefined, field: string): string => {
  const s = v?.trim();
  if (!s) throw new Error(`\`${field}\` is required.`);
  return s;
};

// ---- Analytics: metrics + their time series ----

export async function apiCreateMetric(
  workspaceId: string,
  input: {
    name?: string;
    projectId?: string | null;
    unit?: string | null;
    cadence?: string;
    isNorthStar?: boolean;
  },
): Promise<string> {
  const name = req(input.name, "name");
  if (input.cadence && !["weekly", "monthly", "quarterly"].includes(input.cadence))
    throw new Error("`cadence` must be one of: weekly, monthly, quarterly.");
  const [created] = await db
    .insert(metrics)
    .values({
      workspaceId,
      projectId: input.projectId || null,
      name: name.slice(0, 200),
      unit: input.unit ?? null,
      cadence: input.cadence ?? "monthly",
      isNorthStar: input.isNorthStar ?? false,
      sortKey: `a${Date.now()}`,
    })
    .returning({ id: metrics.id });
  return created.id;
}

/** Metric points hang off a metric, so the metric carries the workspace check. */
async function assertMetric(workspaceId: string, metricId: string): Promise<void> {
  const [row] = await db
    .select({ id: metrics.id })
    .from(metrics)
    .where(and(eq(metrics.workspaceId, workspaceId), eq(metrics.id, metricId)))
    .limit(1);
  if (!row) throw new Error("`metricId`: metric not found in this workspace.");
}

export async function apiListMetricPoints(workspaceId: string, metricId: string) {
  await assertMetric(workspaceId, metricId);
  return db
    .select({
      id: metricPoints.id,
      periodDate: metricPoints.periodDate,
      value: metricPoints.value,
    })
    .from(metricPoints)
    .where(eq(metricPoints.metricId, metricId))
    .orderBy(asc(metricPoints.periodDate));
}

export async function apiAddMetricPoint(
  workspaceId: string,
  metricId: string,
  input: { periodDate?: string; value?: number },
): Promise<string> {
  await assertMetric(workspaceId, metricId);
  const periodDate = toDate(input.periodDate);
  if (!periodDate) throw new Error("`periodDate` is required (ISO date).");
  const value = Number(input.value ?? 0);
  if (!Number.isFinite(value)) throw new Error("`value` must be a number.");

  const [created] = await db
    .insert(metricPoints)
    .values({ metricId, periodDate, value })
    .returning({ id: metricPoints.id });
  return created.id;
}

export async function apiDeleteMetricPoint(
  workspaceId: string,
  metricId: string,
  pointId: string,
): Promise<boolean> {
  await assertMetric(workspaceId, metricId);
  const res = await db
    .delete(metricPoints)
    .where(and(eq(metricPoints.metricId, metricId), eq(metricPoints.id, pointId)))
    .returning({ id: metricPoints.id });
  return res.length > 0;
}

// ---- Product: feedback ----

export async function apiCreateFeedback(
  workspaceId: string,
  input: {
    title?: string;
    body?: string | null;
    projectId?: string | null;
    source?: string;
    status?: string;
    votes?: number;
    contact?: string | null;
    featureId?: string | null;
  },
): Promise<string> {
  const title = req(input.title, "title");
  const [created] = await db
    .insert(feedback)
    .values({
      workspaceId,
      projectId: input.projectId || null,
      title: title.slice(0, 300),
      body: input.body ?? null,
      source: input.source ?? "customer",
      status: input.status ?? "new",
      votes: input.votes ?? 1,
      contact: input.contact ?? null,
      featureId: input.featureId || null,
      sortKey: `a${Date.now()}`,
    })
    .returning({ id: feedback.id });
  return created.id;
}

// ---- Marketing: content calendar ----

export async function apiCreateContent(
  workspaceId: string,
  input: {
    title?: string;
    projectId?: string | null;
    campaignId?: string | null;
    channel?: string | null;
    status?: string;
    url?: string | null;
    notes?: string | null;
    publishDate?: string | null;
    ownerId?: string | null;
  },
): Promise<string> {
  const title = req(input.title, "title");
  const [created] = await db
    .insert(contentItems)
    .values({
      workspaceId,
      projectId: input.projectId || null,
      campaignId: input.campaignId || null,
      title: title.slice(0, 300),
      channel: input.channel ?? null,
      status: input.status ?? "idea",
      url: input.url ?? null,
      notes: input.notes ?? null,
      publishDate: toDate(input.publishDate),
      ownerId: input.ownerId || null,
    })
    .returning({ id: contentItems.id });
  return created.id;
}

// ---- Weekly review: project status updates ----

export async function apiCreateStatusUpdate(
  workspaceId: string,
  userId: string | null,
  input: { projectId?: string; health?: string; body?: string },
): Promise<string> {
  const projectId = req(input.projectId, "projectId");
  const health = input.health ?? "on_track";
  if (!["on_track", "at_risk", "off_track"].includes(health))
    throw new Error("`health` must be one of: on_track, at_risk, off_track.");
  const [created] = await db
    .insert(projectStatusUpdates)
    .values({
      workspaceId,
      projectId,
      authorId: userId,
      health,
      body: input.body ?? "",
    })
    .returning({ id: projectStatusUpdates.id });
  return created.id;
}

// ---- CRM: activity log (calls, meetings, follow-ups) ----

export async function apiCreateActivity(
  workspaceId: string,
  userId: string | null,
  input: {
    type?: string;
    body?: string | null;
    dueDate?: string | null;
    done?: boolean;
    accountId?: string | null;
    contactId?: string | null;
    dealId?: string | null;
    projectId?: string | null;
  },
): Promise<string> {
  const type = input.type ?? "note";
  if (!["note", "call", "email", "task", "meeting"].includes(type))
    throw new Error("`type` must be one of: note, call, email, task, meeting.");
  const [created] = await db
    .insert(crmActivities)
    .values({
      workspaceId,
      projectId: input.projectId || null,
      accountId: input.accountId || null,
      contactId: input.contactId || null,
      dealId: input.dealId || null,
      type,
      body: input.body ?? null,
      dueDate: toDate(input.dueDate),
      done: input.done ?? false,
      actorId: userId,
    })
    .returning({ id: crmActivities.id });
  return created.id;
}

export async function apiListActivities(
  workspaceId: string,
  filter: { dealId?: string | null; accountId?: string | null },
) {
  const conds = [eq(crmActivities.workspaceId, workspaceId)];
  if (filter.dealId) conds.push(eq(crmActivities.dealId, filter.dealId));
  if (filter.accountId) conds.push(eq(crmActivities.accountId, filter.accountId));
  return db
    .select()
    .from(crmActivities)
    .where(and(...conds))
    .orderBy(asc(crmActivities.done), asc(crmActivities.dueDate));
}

// ---- People: org chart roles ----

export async function apiCreateOrgRole(
  workspaceId: string,
  input: { title?: string; userId?: string | null; parentId?: string | null },
): Promise<string> {
  const title = req(input.title, "title");
  const [created] = await db
    .insert(orgRoles)
    .values({
      workspaceId,
      title: title.slice(0, 200),
      userId: input.userId || null,
      parentId: input.parentId || null,
      sortKey: `a${Date.now()}`,
    })
    .returning({ id: orgRoles.id });
  return created.id;
}

// ---- People: members ----

/** Add a member, creating the user record when the email is new. Mirrors the
 *  in-app invite; there is no email delivery, the row is the invite. */
export async function apiAddMember(
  workspaceId: string,
  input: { email?: string; name?: string; role?: string; title?: string | null },
): Promise<string> {
  const email = req(input.email, "email").toLowerCase();
  if (!email.includes("@")) throw new Error("`email` must be a valid address.");

  let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    [user] = await db
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
      workspaceId,
      userId: user.id,
      role: input.role === "admin" ? "admin" : "member",
      title: input.title ?? null,
    })
    .onConflictDoNothing();
  return user.id;
}

export async function apiUpdateMember(
  workspaceId: string,
  userId: string,
  patch: {
    role?: string;
    title?: string | null;
    entity?: string;
    employment?: string;
    startDate?: string | null;
    managerId?: string | null;
  },
): Promise<boolean> {
  const values: Record<string, unknown> = {};
  if (patch.role !== undefined) {
    if (!["admin", "member"].includes(patch.role))
      throw new Error("`role` must be admin or member.");
    values.role = patch.role;
  }
  if (patch.title !== undefined) values.title = patch.title;
  if (patch.entity !== undefined) {
    if (!["India", "Netherlands", "Global"].includes(patch.entity))
      throw new Error("`entity` must be one of: India, Netherlands, Global.");
    values.entity = patch.entity;
  }
  if (patch.employment !== undefined) {
    if (!["employee", "contractor"].includes(patch.employment))
      throw new Error("`employment` must be employee or contractor.");
    values.employment = patch.employment;
  }
  if (patch.startDate !== undefined) values.startDate = toDate(patch.startDate);
  if (patch.managerId !== undefined) values.managerId = patch.managerId || null;
  if (Object.keys(values).length === 0)
    throw new Error(
      "No writable fields. Writable: role, title, entity, employment, startDate, managerId.",
    );

  const res = await db
    .update(workspaceMembers)
    .set(values)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    )
    .returning({ userId: workspaceMembers.userId });
  return res.length > 0;
}

/** Remove someone from the workspace. The user row itself is left alone so
 *  their authored history keeps its author. */
export async function apiRemoveMember(
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  const admins = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(
      and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.role, "admin")),
    );
  if (admins.length === 1 && admins[0].userId === userId)
    throw new Error("Cannot remove the last admin of the workspace.");

  const res = await db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    )
    .returning({ userId: workspaceMembers.userId });
  return res.length > 0;
}

// ---- Notion-style databases ----

export async function apiCreateDatabase(
  workspaceId: string,
  input: { name?: string; icon?: string },
): Promise<string> {
  const [created] = await db
    .insert(databases)
    .values({
      workspaceId,
      name: input.name?.trim() || "Untitled database",
      icon: input.icon?.trim() || "🗃️",
    })
    .returning({ id: databases.id });
  return created.id;
}

/** Fields and rows key off databaseId, so the database carries the check. */
async function assertDatabase(workspaceId: string, databaseId: string): Promise<void> {
  const [row] = await db
    .select({ id: databases.id })
    .from(databases)
    .where(and(eq(databases.workspaceId, workspaceId), eq(databases.id, databaseId)))
    .limit(1);
  if (!row) throw new Error("`databaseId`: database not found in this workspace.");
}

const FIELD_TYPES = [
  "text",
  "number",
  "select",
  "checkbox",
  "date",
  "relation",
  "rollup",
];

export async function apiAddDatabaseField(
  workspaceId: string,
  databaseId: string,
  input: { name?: string; type?: string; options?: unknown },
): Promise<string> {
  await assertDatabase(workspaceId, databaseId);
  const name = req(input.name, "name");
  const type = input.type ?? "text";
  if (!FIELD_TYPES.includes(type))
    throw new Error(`\`type\` must be one of: ${FIELD_TYPES.join(", ")}.`);

  const [{ value: last }] = await db
    .select({ value: max(databaseFields.position) })
    .from(databaseFields)
    .where(eq(databaseFields.databaseId, databaseId));

  const [created] = await db
    .insert(databaseFields)
    .values({
      databaseId,
      name: name.slice(0, 120),
      type,
      options: (input.options as never) ?? null,
      position: `${last ?? "a"}a`,
    })
    .returning({ id: databaseFields.id });
  return created.id;
}

export async function apiDeleteDatabaseField(
  workspaceId: string,
  databaseId: string,
  fieldId: string,
): Promise<boolean> {
  await assertDatabase(workspaceId, databaseId);
  const res = await db
    .delete(databaseFields)
    .where(
      and(eq(databaseFields.databaseId, databaseId), eq(databaseFields.id, fieldId)),
    )
    .returning({ id: databaseFields.id });
  return res.length > 0;
}

export async function apiAddDatabaseRow(
  workspaceId: string,
  databaseId: string,
  values: Record<string, unknown>,
): Promise<string> {
  await assertDatabase(workspaceId, databaseId);
  const [{ value: last }] = await db
    .select({ value: max(databaseRows.position) })
    .from(databaseRows)
    .where(eq(databaseRows.databaseId, databaseId));

  const [created] = await db
    .insert(databaseRows)
    .values({
      databaseId,
      values: (values ?? {}) as never,
      position: `${last ?? "a"}a`,
    })
    .returning({ id: databaseRows.id });
  return created.id;
}

/** Merge into a row's cell values — omitted keys keep their current value. */
export async function apiUpdateDatabaseRow(
  workspaceId: string,
  databaseId: string,
  rowId: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  await assertDatabase(workspaceId, databaseId);
  const [row] = await db
    .select({ values: databaseRows.values })
    .from(databaseRows)
    .where(and(eq(databaseRows.databaseId, databaseId), eq(databaseRows.id, rowId)))
    .limit(1);
  if (!row) return false;

  const merged = { ...(row.values as Record<string, unknown>), ...(patch ?? {}) };
  await db
    .update(databaseRows)
    .set({ values: merged as never })
    .where(and(eq(databaseRows.databaseId, databaseId), eq(databaseRows.id, rowId)));
  return true;
}

export async function apiDeleteDatabaseRow(
  workspaceId: string,
  databaseId: string,
  rowId: string,
): Promise<boolean> {
  await assertDatabase(workspaceId, databaseId);
  const res = await db
    .delete(databaseRows)
    .where(and(eq(databaseRows.databaseId, databaseId), eq(databaseRows.id, rowId)))
    .returning({ id: databaseRows.id });
  return res.length > 0;
}
