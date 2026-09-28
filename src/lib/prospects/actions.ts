"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";

import { getCurrentUser, getWorkspace } from "@/lib/data";
import type { ActivityEntry, ProspectRecord } from "./parse";
import { displayDate } from "./parse";
import { loadWorkbook, PROSPECTS_TAG } from "./read";
import { CHANNELS, DIRECTIONS, OUTCOMES, PROSPECT_KINDS, RECORD_TYPE, STAGES, WRITABLE, type ProspectKind } from "./schema";
import { todayIST } from "./stats";
import { appendActivity, writeRecord } from "./write";
import type { CellPatch } from "./plan";

export type ActionResult = { ok: true; message: string; written: string[] } | { ok: false; message: string };

const kindSchema = z.enum(PROSPECT_KINDS);
const idSchema = z.string().trim().min(1).max(80);
const valueSchema = z.union([z.string().max(20_000), z.number(), z.null()]);

function invalidate() {
  updateTag(PROSPECTS_TAG);
  refresh();
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message.slice(0, 400) : "Something went wrong writing to the sheet.";
}

/** "dd-mm-yyyy hh:mm", India time — how Activity's logged_at reads. */
function nowIST(): string {
  const d = new Date(Date.now() + 5.5 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}-${p(d.getUTCMonth() + 1)}-${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

async function signedInName(): Promise<string> {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  return (me.name || me.email || "Unknown").trim();
}

/** The full record behind a row, plus its Activity history, for the side panel and full page. */
export async function getProspectDetail(kind: ProspectKind, id: string): Promise<{ record: ProspectRecord; activity: ActivityEntry[] } | null> {
  await getWorkspace();
  const k = kindSchema.parse(kind);
  const wb = await loadWorkbook();
  const list = k === "valuer" ? wb.valuers : k === "firm" ? wb.firms : wb.rvos;
  const record = list.find((r) => r.id === id);
  if (!record) return null;
  const activity = wb.activity.filter((a) => a.registrationNo === id).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.id.localeCompare(a.id));
  return { record, activity };
}

/** Write edited cells on one row. Only the dashboard's writable columns are accepted. */
export async function saveProspect(kind: ProspectKind, id: string, patch: Record<string, string | number | null>): Promise<ActionResult> {
  await getWorkspace();
  const k = kindSchema.parse(kind);
  const clean = z.record(z.string(), valueSchema).parse(patch);
  const unknown = Object.keys(clean).filter((c) => !WRITABLE[k].has(c));
  if (unknown.length) return { ok: false, message: `Not editable from the dashboard: ${unknown.join(", ")}.` };
  try {
    const { written } = await writeRecord(k, idSchema.parse(id), clean);
    invalidate();
    return { ok: true, written, message: `Saved to the sheet: ${written.join(", ")}.` };
  } catch (err) {
    return { ok: false, message: errorMessage(err) };
  }
}

/** Assign a row to whoever is signed in, by their first name as the team writes it. */
export async function assignToMe(kind: ProspectKind, ids: string[]): Promise<ActionResult> {
  const name = (await signedInName()).split(/\s+/)[0];
  const done: string[] = [];
  for (const id of ids.slice(0, 50)) {
    const r = await saveProspect(kind, id, { assigned: name });
    if (!r.ok) return { ok: false, message: `${done.length} assigned; stopped at ${id}: ${r.message}` };
    done.push(id);
  }
  return { ok: true, written: ["assigned"], message: `Assigned ${done.length} to ${name}.` };
}

const touchSchema = z.object({
  kind: kindSchema,
  id: idSchema,
  name: z.string().max(200),
  channel: z.enum(CHANNELS),
  direction: z.enum(DIRECTIONS),
  outcome: z.enum(OUTCOMES),
  durationMin: z.number().min(0).max(600).nullable(),
  summary: z.string().max(2000),
  statusAfter: z.enum(STAGES),
  nextStep: z.string().max(500).nullable(),
  nextStepDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  fields: z
    .object({
      current_software: z.string().max(200).optional(),
      lb_cases_per_month: z.number().min(0).max(100_000).optional(),
      objections: z.string().max(200).optional(),
      pitch_angle: z.string().max(200).optional(),
      referred_by: z.string().max(200).optional(),
    })
    .default({}),
});

export type TouchInput = z.input<typeof touchSchema>;

/**
 * Log a call, message or meeting: updates the row (status, last_contacted,
 * next step, what was learnt, a dated line at the top of notes) and appends
 * one row to Activity, which is where the history and the stats come from.
 */
export async function logTouch(input: TouchInput): Promise<ActionResult> {
  const t = touchSchema.parse(input);
  const by = await signedInName();
  const today = todayIST();
  const patch: CellPatch = { status: t.statusAfter, last_contacted: today };
  if (t.nextStepDate !== null) patch.next_step_date = t.nextStepDate;
  if (t.nextStep !== null) patch.next_step = t.nextStep;
  for (const [col, value] of Object.entries(t.fields)) {
    if (value !== undefined && value !== "" && WRITABLE[t.kind].has(col)) patch[col] = value;
  }
  const minutes = t.durationMin ? ` (${t.durationMin} min)` : "";
  patch.prependNote = `${displayDate(today)} — ${t.channel}${minutes}: ${t.outcome}${t.summary ? `. ${t.summary}` : ""} — ${by.split(/\s+/)[0]}`;
  try {
    const { written } = await writeRecord(t.kind, t.id, patch);
    const activityId = await appendActivity({
      loggedAt: nowIST(),
      recordType: RECORD_TYPE[t.kind],
      registrationNo: t.id,
      name: t.name,
      by,
      channel: t.channel,
      direction: t.direction,
      outcome: t.outcome,
      durationMin: t.durationMin,
      statusAfter: t.statusAfter,
      summary: t.summary,
    });
    invalidate();
    return { ok: true, written: [...written, `Activity ${activityId}`], message: `Saved to the sheet: ${written.join(", ")} · Activity ${activityId}.` };
  } catch (err) {
    return { ok: false, message: errorMessage(err) };
  }
}

/** Re-read the sheet now instead of waiting for the one-minute cache. */
export async function refreshProspects(): Promise<void> {
  await getWorkspace();
  invalidate();
}
