import "server-only";

import type { ActivityEntry, ProspectRecord } from "./parse";
import { recordsOf } from "./parse";
import { loadWorkbook } from "./read";
import { RECORD_TYPE, WRITABLE, type ProspectKind } from "./schema";
import { todayIST } from "./stats";
import { firstName, idSchema, kindSchema, nowIST, patchSchema, touchPatch, touchSchema, type TouchInput } from "./touch";
import { appendActivity, writeRecord } from "./write";

/**
 * The prospects rules, free of any notion of who is signed in or how. The web's
 * server actions and the mobile API both call these, each passing the acting
 * member's name and its own way of expiring the cached workbook — so the sheet
 * is only ever written one way, whichever door a change comes through.
 */

export type ProspectResult = { ok: true; message: string; written: string[] } | { ok: false; message: string };

/** Expire the cached workbook after a write, so the writer sees their own change. */
export type Invalidate = () => void;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message.slice(0, 400) : "Something went wrong writing to the sheet.";
}

/** The full record behind a row, plus its Activity history, newest first. */
export async function readProspectDetail(kind: ProspectKind, id: string): Promise<{ record: ProspectRecord; activity: ActivityEntry[] } | null> {
  const k = kindSchema.parse(kind);
  const wb = await loadWorkbook();
  const record = recordsOf(wb, k).find((r) => r.id === id);
  if (!record) return null;
  const activity = wb.activity.filter((a) => a.registrationNo === id).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.id.localeCompare(a.id));
  return { record, activity };
}

/** Write edited cells on one row. Only the dashboard's writable columns are accepted. */
export async function saveProspectRecord(kind: ProspectKind, id: string, patch: Record<string, string | number | null>, invalidate: Invalidate): Promise<ProspectResult> {
  const k = kindSchema.parse(kind);
  const clean = patchSchema.parse(patch);
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

/** Assign rows to a member, by their first name as the team writes it. At most 50 at a time. */
export async function assignProspects(kind: ProspectKind, ids: string[], memberName: string, invalidate: Invalidate): Promise<ProspectResult> {
  const name = firstName(memberName);
  const done: string[] = [];
  for (const id of ids.slice(0, 50)) {
    const r = await saveProspectRecord(kind, id, { assigned: name }, invalidate);
    if (!r.ok) return { ok: false, message: `${done.length} assigned; stopped at ${id}: ${r.message}` };
    done.push(id);
  }
  return { ok: true, written: ["assigned"], message: `Assigned ${done.length} to ${name}.` };
}

/**
 * Log a call, message or meeting: updates the row (status, last_contacted,
 * next step, what was learnt, a dated line at the top of notes) and appends
 * one row to Activity, which is where the history and the stats come from.
 */
export async function logProspectTouch(input: TouchInput, by: string, invalidate: Invalidate): Promise<ProspectResult> {
  const t = touchSchema.parse(input);
  const patch = touchPatch(t, by, todayIST());
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
