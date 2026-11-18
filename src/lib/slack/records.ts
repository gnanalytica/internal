import "server-only";

import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { activity, comments, contentItems, deals, feedback, issues, projects, tickets, users } from "@/db/schema";
import { customerRequestsHref } from "@/lib/departments";
import { PROSPECTS_PRODUCT_KEY } from "@/lib/prospects/schema";
import {
  contentFields,
  dealFields,
  feedbackFields,
  issueFields,
  issueIdentifier,
  prospectFields,
  ticketFields,
  type RecordSnapshot,
} from "./cards";
import type { SlackEventFacts, SlackEventInput, SlackRecordType } from "./events";

/**
 * Reads an app record as Slack shows it. Everything is read fresh when an event
 * is delivered (after the response), so a card always shows the record as it
 * is now, whichever code path changed it. Each record is a single joined
 * select by id and workspace.
 */

const assignee = alias(users, "assignee");

async function issueSnapshot(workspaceId: string, id: string): Promise<RecordSnapshot | null> {
  const [r] = await db
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
    .where(and(eq(issues.workspaceId, workspaceId), eq(issues.id, id)))
    .limit(1);
  if (!r) return null;
  return {
    type: "issue",
    id: r.id,
    workspaceId,
    projectId: r.projectId,
    title: `${issueIdentifier(r)} · ${r.title}`,
    path: `/issues/${r.id}`,
    fields: issueFields(r),
    status: r.status,
  };
}

const prospectPath = (ref: string) => `/prospects?rec=${encodeURIComponent(ref)}`;

async function dealSnapshot(workspaceId: string, id: string): Promise<RecordSnapshot | null> {
  const [r] = await db
    .select({
      id: deals.id,
      name: deals.name,
      stage: deals.stage,
      value: deals.value,
      entity: deals.entity,
      prospectRef: deals.prospectRef,
      projectId: deals.projectId,
      projectName: projects.name,
      ownerName: users.name,
    })
    .from(deals)
    .leftJoin(projects, eq(projects.id, deals.projectId))
    .leftJoin(users, eq(users.id, deals.ownerId))
    .where(and(eq(deals.workspaceId, workspaceId), eq(deals.id, id)))
    .limit(1);
  if (!r) return null;
  return {
    type: "deal",
    id: r.id,
    workspaceId,
    projectId: r.projectId,
    title: r.name,
    // A prospect's deal opens on its prospect, where the team works it.
    path: r.prospectRef ? prospectPath(r.prospectRef) : r.projectId ? `/projects/${r.projectId}/sales` : "/",
    fields: dealFields(r),
  };
}

/** Prospects live in the sheet, so the event carries the row; the database adds the project and any deal. */
async function prospectSnapshot(
  workspaceId: string,
  ref: string,
  p: NonNullable<SlackEventInput["prospect"]>,
): Promise<RecordSnapshot> {
  const [[project], [deal]] = await Promise.all([
    db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(and(eq(projects.workspaceId, workspaceId), eq(projects.key, PROSPECTS_PRODUCT_KEY)))
      .limit(1),
    db
      .select({ value: deals.value })
      .from(deals)
      .where(and(eq(deals.workspaceId, workspaceId), eq(deals.prospectRef, ref)))
      .limit(1),
  ]);
  return {
    type: "prospect",
    id: ref,
    workspaceId,
    projectId: project?.id ?? null,
    title: p.name,
    path: prospectPath(ref),
    fields: prospectFields({ ref, from: p.from, to: p.to, projectName: project?.name ?? null, dealValue: deal?.value ?? null }),
  };
}

async function ticketSnapshot(workspaceId: string, id: string): Promise<RecordSnapshot | null> {
  const [r] = await db
    .select({
      id: tickets.id,
      subject: tickets.subject,
      status: tickets.status,
      priority: tickets.priority,
      via: tickets.via,
      projectId: tickets.projectId,
      projectName: projects.name,
      customer: deals.name,
      assigneeName: users.name,
    })
    .from(tickets)
    .leftJoin(projects, eq(projects.id, tickets.projectId))
    .leftJoin(deals, eq(deals.id, tickets.dealId))
    .leftJoin(users, eq(users.id, tickets.assigneeId))
    .where(and(eq(tickets.workspaceId, workspaceId), eq(tickets.id, id)))
    .limit(1);
  if (!r) return null;
  return {
    type: "ticket",
    id: r.id,
    workspaceId,
    projectId: r.projectId,
    title: r.subject,
    path: r.projectId ? customerRequestsHref(r.projectId) : "/",
    fields: ticketFields(r),
  };
}

async function feedbackSnapshot(workspaceId: string, id: string): Promise<RecordSnapshot | null> {
  const [r] = await db
    .select({
      id: feedback.id,
      title: feedback.title,
      source: feedback.source,
      contact: feedback.contact,
      theme: feedback.theme,
      projectId: feedback.projectId,
      projectName: projects.name,
    })
    .from(feedback)
    .leftJoin(projects, eq(projects.id, feedback.projectId))
    .where(and(eq(feedback.workspaceId, workspaceId), eq(feedback.id, id)))
    .limit(1);
  if (!r) return null;
  return {
    type: "feedback",
    id: r.id,
    workspaceId,
    projectId: r.projectId,
    title: r.title,
    path: r.projectId ? `/projects/${r.projectId}/product?tab=feedback` : "/",
    fields: feedbackFields(r),
  };
}

async function contentSnapshot(workspaceId: string, id: string): Promise<RecordSnapshot | null> {
  const [r] = await db
    .select({
      id: contentItems.id,
      title: contentItems.title,
      channel: contentItems.channel,
      url: contentItems.url,
      projectId: contentItems.projectId,
      projectName: projects.name,
      ownerName: users.name,
    })
    .from(contentItems)
    .leftJoin(projects, eq(projects.id, contentItems.projectId))
    .leftJoin(users, eq(users.id, contentItems.ownerId))
    .where(and(eq(contentItems.workspaceId, workspaceId), eq(contentItems.id, id)))
    .limit(1);
  if (!r) return null;
  return {
    type: "content",
    id: r.id,
    workspaceId,
    projectId: r.projectId,
    title: r.title,
    path: r.projectId ? `/projects/${r.projectId}/marketing` : "/",
    fields: contentFields(r),
  };
}

/**
 * A record as Slack shows it, or null if it's gone (or isn't in this
 * workspace). Prospects need the sheet row, which only their events carry.
 */
export async function loadSnapshot(
  workspaceId: string,
  type: SlackRecordType,
  id: string,
  prospect?: SlackEventInput["prospect"],
): Promise<RecordSnapshot | null> {
  switch (type) {
    case "issue":
      return issueSnapshot(workspaceId, id);
    case "deal":
      return dealSnapshot(workspaceId, id);
    case "prospect":
      return prospect ? prospectSnapshot(workspaceId, id, prospect) : null;
    case "ticket":
      return ticketSnapshot(workspaceId, id);
    case "feedback":
      return feedbackSnapshot(workspaceId, id);
    case "content":
      return contentSnapshot(workspaceId, id);
  }
}

/** How long ago an issue's activity row may be and still describe "this" change. */
const RECENT_MS = 2 * 60_000;

/**
 * What the event's caller didn't know, recovered from what it wrote: who did
 * it, and for status changes what it was before. The web app logs a status or
 * assignee change to `activity` (and a comment to `comments`) before the
 * outbound hooks fire; the API doesn't log activity, so there the actor is
 * whoever the caller passed, or unknown.
 */
export async function eventContext(
  workspaceId: string,
  ev: SlackEventInput,
): Promise<{ actorId: string | null; from: string | null; to: string | null; body: string | undefined; logged: boolean }> {
  let actorId = ev.actorId ?? null;
  let from: string | null = null;
  let to: string | null = null;
  let body = ev.body;
  let logged = false;
  if (ev.type === "issue.status_changed" || ev.type === "issue.assigned") {
    const [a] = await db
      .select({ actorId: activity.actorId, data: activity.data })
      .from(activity)
      .where(
        and(
          eq(activity.workspaceId, workspaceId),
          eq(activity.issueId, ev.recordId),
          eq(activity.type, ev.type === "issue.status_changed" ? "status" : "assignee"),
          gt(activity.createdAt, new Date(Date.now() - RECENT_MS)),
        ),
      )
      .orderBy(desc(activity.createdAt))
      .limit(1);
    if (a) {
      logged = true;
      actorId ??= a.actorId;
      const d = (a.data ?? {}) as { from?: string | null; to?: string | null };
      from = d.from ?? null;
      to = d.to ?? null;
    }
  } else if (ev.type === "issue.commented") {
    const [c] = await db
      .select({ authorId: comments.authorId, body: comments.body })
      .from(comments)
      .where(and(eq(comments.workspaceId, workspaceId), eq(comments.issueId, ev.recordId)))
      .orderBy(desc(comments.createdAt))
      .limit(1);
    if (c) {
      actorId ??= c.authorId;
      body ??= c.body;
    }
  } else if (ev.type === "issue.created") {
    const [i] = await db
      .select({ creatorId: issues.creatorId })
      .from(issues)
      .where(and(eq(issues.workspaceId, workspaceId), eq(issues.id, ev.recordId)))
      .limit(1);
    actorId ??= i?.creatorId ?? null;
  } else if (ev.type === "deal.won" && !actorId) {
    // The board doesn't say who dragged a deal to Won; its owner closed it.
    const [d] = await db
      .select({ ownerId: deals.ownerId })
      .from(deals)
      .where(and(eq(deals.workspaceId, workspaceId), eq(deals.id, ev.recordId)))
      .limit(1);
    actorId = d?.ownerId ?? null;
  }
  return { actorId, from, to, body, logged };
}

/** Display names for a few user ids. */
export async function userNames(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const want = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (want.length === 0) return new Map();
  const rows = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, want));
  return new Map(rows.map((r) => [r.id, r.name]));
}

/** The facts rules match on, from a snapshot. */
export function factsOf(ev: SlackEventInput, snap: RecordSnapshot): SlackEventFacts {
  return { type: ev.type, projectId: snap.projectId, prospectStage: ev.prospect?.to ?? null };
}

