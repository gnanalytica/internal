"use server";

import { refresh, updateTag } from "next/cache";

import { getCurrentUser, getMembers, getWorkspace } from "@/lib/data";
import type { ActivityEntry, ProspectRecord } from "./parse";
import { recordsOf } from "./parse";
import { loadWorkbook, PROSPECTS_TAG } from "./read";
import { relatedRecords, type Related } from "./related";
import type { ProspectKind } from "./schema";
import { isAssignedTo } from "./stats";
import { assignProspects, logProspectTouch, readProspectDetail, saveProspectRecord, type ProspectResult } from "./service";
import type { TouchInput as ServiceTouchInput } from "./touch";

export type ActionResult = ProspectResult;
export type TouchInput = ServiceTouchInput;

function invalidate() {
  updateTag(PROSPECTS_TAG);
  refresh();
}

async function signedInName(): Promise<string> {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  return (me.name || me.email || "Unknown").trim();
}

/** The full record behind a row, plus its Activity history, for the side panel and full page. */
export async function getProspectDetail(kind: ProspectKind, id: string): Promise<{ record: ProspectRecord; activity: ActivityEntry[] } | null> {
  await getWorkspace();
  return readProspectDetail(kind, id);
}

/** Write edited cells on one row. Only the dashboard's writable columns are accepted. */
export async function saveProspect(kind: ProspectKind, id: string, patch: Record<string, string | number | null>): Promise<ActionResult> {
  await getWorkspace();
  return saveProspectRecord(kind, id, patch, invalidate);
}

/** Assign a row to whoever is signed in, by their first name as the team writes it. */
export async function assignToMe(kind: ProspectKind, ids: string[]): Promise<ActionResult> {
  return assignProspects(kind, ids, await signedInName(), invalidate);
}

/**
 * Assign rows to a teammate. Only names of workspace members are accepted, so
 * a typo can't leave rows owned by nobody anyone recognises.
 */
export async function assignTo(kind: ProspectKind, ids: string[], person: string): Promise<ActionResult> {
  const ws = await getWorkspace();
  const members = await getMembers(ws.id);
  const member = members.map((m) => (m.name || m.email || "").trim()).find((n) => n && isAssignedTo(person, n));
  if (!member) return { ok: false, message: `${person} is not a member of this workspace.` };
  return assignProspects(kind, ids, member, invalidate);
}

/** The rows a prospect is connected to (firm, partners, lenders, panel, members). */
export async function getRelatedProspects(kind: ProspectKind, id: string): Promise<{ items: Related[]; more: number }> {
  await getWorkspace();
  const wb = await loadWorkbook();
  const record = recordsOf(wb, kind).find((r) => r.id === id);
  return record ? relatedRecords(wb, record) : { items: [], more: 0 };
}

/**
 * Log a call, message or meeting: updates the row (status, last_contacted,
 * next step, what was learnt, a dated line at the top of notes) and appends
 * one row to Activity, which is where the history and the stats come from.
 */
export async function logTouch(input: TouchInput): Promise<ActionResult> {
  return logProspectTouch(input, await signedInName(), invalidate);
}

/** Re-read the sheet now instead of waiting for the one-minute cache. */
export async function refreshProspects(): Promise<void> {
  await getWorkspace();
  invalidate();
}
