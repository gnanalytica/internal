"use server";

import { refresh, updateTag } from "next/cache";

import { getCurrentUser, getMembers, getWorkspace } from "@/lib/data";
import type { DealContext } from "./deals";
import type { ActivityEntry, ProspectRecord } from "./parse";
import { recordsOf } from "./parse";
import { loadWorkbook, PROSPECTS_TAG } from "./read";
import { relatedRecords, type Related } from "./related";
import type { ProspectKind } from "./schema";
import { isAssignedTo } from "./stats";
import { assignProspects, BULK_LIMIT, logProspectTouch, readProspectDetail, saveProspectRecord, saveProspectRecords, type BulkResult, type ProspectResult } from "./service";
import type { TouchInput as ServiceTouchInput } from "./touch";

export type ActionResult = ProspectResult;
export type TouchInput = ServiceTouchInput;

function invalidate() {
  updateTag(PROSPECTS_TAG);
  refresh();
}

/** Who is acting: their name as the sheet writes it, and where a deal they open goes. */
async function signedIn(): Promise<{ name: string; dealCtx: DealContext }> {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  return { name: (me.name || me.email || "Unknown").trim(), dealCtx: { workspaceId: ws.id, userId: me.id } };
}

/** The full record behind a row, plus its Activity history, for the side panel and full page. */
export async function getProspectDetail(kind: ProspectKind, id: string): Promise<{ record: ProspectRecord; activity: ActivityEntry[] } | null> {
  await getWorkspace();
  return readProspectDetail(kind, id);
}

/** Write edited cells on one row. Only the dashboard's writable columns are accepted. */
export async function saveProspect(kind: ProspectKind, id: string, patch: Record<string, string | number | null>): Promise<ActionResult> {
  const { dealCtx } = await signedIn();
  return saveProspectRecord(kind, id, patch, invalidate, dealCtx);
}

/**
 * The same cells on many rows, possibly of different kinds, as one batch per
 * kind on the server. The browser runs server actions one at a time, so a
 * loop of saveProspect calls would write rows one by one.
 */
export async function saveProspects(rows: { kind: ProspectKind; id: string }[], patch: Record<string, string | number | null>): Promise<BulkResult> {
  const { dealCtx } = await signedIn();
  const byKind = new Map<ProspectKind, string[]>();
  for (const r of rows.slice(0, BULK_LIMIT)) byKind.set(r.kind, [...(byKind.get(r.kind) ?? []), r.id]);
  const parts = await Promise.all([...byKind].map(([k, ids]) => saveProspectRecords(k, ids, patch, invalidate, dealCtx)));
  const ok = parts.reduce((n, p) => n + p.ok, 0);
  const failed = parts.flatMap((p) => p.failed);
  const message = failed.length ? `${ok} saved; ${failed.length} failed: ${failed[0].message}` : ok ? `Saved ${ok} to the sheet.` : (parts[0]?.message ?? "Nothing to save.");
  return { ok, failed, message };
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
  const { name, dealCtx } = await signedIn();
  return logProspectTouch(input, name, invalidate, dealCtx);
}

/** Re-read the sheet now instead of waiting for the one-minute cache. */
export async function refreshProspects(): Promise<void> {
  await getWorkspace();
  invalidate();
}
