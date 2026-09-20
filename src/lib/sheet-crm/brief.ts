import { and, eq, gte, inArray, isNotNull, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { crmContacts, interactions, sheetCellWrites, sheetSyncRuns } from "@/db/schema";
import { OUTREACH_STATUS_MAP, isOutreachStatus } from "./outreach";
import { SHEET_SOURCE } from "./projection";

/**
 * The founder's morning outreach brief: meetings today (with the person's
 * one-line context), replies since yesterday, next actions due, people
 * left in "planned" too long, and anything the sync could not do. Plain
 * text, one section per finding, empty sections omitted.
 */
export type Brief = { text: string; items: number };

const DAY = 864e5;

export async function buildOutreachBrief(workspaceId: string, baseUrl: string, now = new Date()): Promise<Brief> {
  try {
    return await outreachBrief(workspaceId, baseUrl, now);
  } catch (err) {
    // The daily digest sends to everyone; one workspace whose schema is not
    // pushed yet must not cost the others their mail.
    console.warn("[outreach-brief] skipped", err instanceof Error ? err.message : err);
    return { text: "", items: 0 };
  }
}

async function outreachBrief(workspaceId: string, baseUrl: string, now: Date): Promise<Brief> {
  const lines: string[] = [];
  let items = 0;
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + DAY);

  const meetings = await db
    .select({ subject: interactions.subject, at: interactions.occurredAt, url: interactions.externalUrl, name: crmContacts.name, id: crmContacts.id, channel: crmContacts.bestFirstChannel })
    .from(interactions)
    .innerJoin(crmContacts, eq(crmContacts.id, interactions.contactId))
    .where(and(eq(interactions.workspaceId, workspaceId), eq(interactions.channel, "meeting"), gte(interactions.occurredAt, startOfDay), lt(interactions.occurredAt, endOfDay)))
    .orderBy(interactions.occurredAt);
  if (meetings.length) {
    lines.push("MEETINGS TODAY");
    for (const m of meetings) {
      items++;
      lines.push(`  ${m.at.toISOString().slice(11, 16)} UTC  ${m.name} — ${m.subject ?? "meeting"}\n         ${baseUrl}/people/${m.id}${m.url ? `\n         ${m.url}` : ""}`);
    }
    lines.push("");
  }

  const replies = await db
    .select({ subject: interactions.subject, channel: interactions.channel, at: interactions.occurredAt, name: crmContacts.name, id: crmContacts.id })
    .from(interactions)
    .innerJoin(crmContacts, eq(crmContacts.id, interactions.contactId))
    .where(and(eq(interactions.workspaceId, workspaceId), eq(interactions.direction, "in"), gte(interactions.occurredAt, new Date(now.getTime() - DAY))))
    .orderBy(sql`${interactions.occurredAt} desc`)
    .limit(20);
  if (replies.length) {
    lines.push("REPLIES SINCE YESTERDAY");
    for (const r of replies) {
      items++;
      lines.push(`  ${r.name} via ${r.channel}${r.subject ? ` — ${r.subject}` : ""}\n         ${baseUrl}/people/${r.id}`);
    }
    lines.push("");
  }

  const due = await db
    .select({ name: crmContacts.name, id: crmContacts.id, at: crmContacts.nextActionAt, status: crmContacts.outreachStatus })
    .from(crmContacts)
    .where(and(eq(crmContacts.workspaceId, workspaceId), isNotNull(crmContacts.nextActionAt), lt(crmContacts.nextActionAt, endOfDay)))
    .orderBy(crmContacts.nextActionAt)
    .limit(20);
  if (due.length) {
    lines.push("NEXT ACTIONS DUE");
    for (const d of due) {
      items++;
      lines.push(`  ${d.name} (${isOutreachStatus(d.status) ? OUTREACH_STATUS_MAP[d.status].label : d.status}) — ${d.at!.toISOString().slice(0, 10)}\n         ${baseUrl}/people/${d.id}`);
    }
    lines.push("");
  }

  const stale = await db
    .select({ name: crmContacts.name, id: crmContacts.id, priority: crmContacts.priority })
    .from(crmContacts)
    .where(and(eq(crmContacts.workspaceId, workspaceId), eq(crmContacts.externalSource, SHEET_SOURCE), inArray(crmContacts.outreachStatus, ["planned", "contacted"]), sql`coalesce(${crmContacts.lastContactedAt}, ${crmContacts.createdAt}) < ${new Date(now.getTime() - 7 * DAY)}`))
    .orderBy(crmContacts.priority)
    .limit(15);
  if (stale.length) {
    lines.push("WAITING MORE THAN A WEEK (planned or contacted, nothing since)");
    for (const s of stale) {
      items++;
      lines.push(`  ${s.priority ? `[${s.priority}] ` : ""}${s.name}\n         ${baseUrl}/people/${s.id}`);
    }
    lines.push("");
  }

  const [lastRun] = await db.select({ status: sheetSyncRuns.status, error: sheetSyncRuns.error, at: sheetSyncRuns.startedAt }).from(sheetSyncRuns).where(eq(sheetSyncRuns.workspaceId, workspaceId)).orderBy(sql`${sheetSyncRuns.startedAt} desc`).limit(1);
  const pending = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(sheetCellWrites)
    .where(and(eq(sheetCellWrites.workspaceId, workspaceId), inArray(sheetCellWrites.status, ["pending", "conflict", "row_not_found", "failed"]), gte(sheetCellWrites.writtenAt, new Date(now.getTime() - DAY))));
  const syncLines: string[] = [];
  if (lastRun?.status === "failed") syncLines.push(`  Last sheet sync FAILED (${lastRun.at.toISOString().slice(0, 16)}): ${lastRun.error?.slice(0, 160)}`);
  else if (lastRun && now.getTime() - lastRun.at.getTime() > 2 * 3600e3) syncLines.push(`  No sheet sync since ${lastRun.at.toISOString().slice(0, 16)} UTC.`);
  if (pending[0]?.n) syncLines.push(`  ${pending[0].n} edit(s) in the last day did not reach the sheet (pending / conflict).`);
  if (syncLines.length) {
    lines.push("SHEET SYNC");
    lines.push(...syncLines, "");
    items += syncLines.length;
  }

  return { text: lines.join("\n").trim(), items };
}
