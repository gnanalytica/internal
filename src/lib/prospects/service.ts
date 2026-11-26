import "server-only";

import { syncProspectDeal, type DealContext } from "./deals";
import type { ActivityEntry, ProspectRecord } from "./parse";
import { recordsOf } from "./parse";
import { loadWorkbook } from "./read";
import { relatedRecords, type Related } from "./related";
import { PROSPECT_KINDS, RECORD_TYPE, WRITABLE, type ProspectKind } from "./schema";
import { todayIST } from "./stats";
import { firstName, idSchema, kindSchema, nowIST, patchSchema, touchPatch, touchSchema, type TouchInput } from "./touch";
import { duplicateMessage, findDuplicates, newLeadSchema, type DuplicateMatch, type NewLeadInput } from "./linkedin";
import { appendActivity, appendLinkedInLead, writeRecord, writeRecords } from "./write";

/**
 * The prospects rules, free of any notion of who is signed in or how. The web's
 * server actions and the mobile API both call these, each passing the acting
 * member's name and its own way of expiring the cached workbook — so the sheet
 * is only ever written one way, whichever door a change comes through.
 *
 * Both doors also pass the workspace and member acting (a DealContext), so a
 * status change that reaches "Demo done" or later opens or moves the
 * prospect's deal on the product's Sales board — see deals.ts. A deal that
 * fails to write never fails the sheet write.
 */

export type ProspectResult = { ok: true; message: string; written: string[]; activityId?: string } | { ok: false; message: string };

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

/** What the web's record page shows: the detail above plus the rows it is connected to, from one workbook read. */
export async function readProspectView(kind: ProspectKind, id: string): Promise<{ record: ProspectRecord; activity: ActivityEntry[]; related: { items: Related[]; more: number } } | null> {
  const k = kindSchema.parse(kind);
  const wb = await loadWorkbook();
  const record = recordsOf(wb, k).find((r) => r.id === id);
  if (!record) return null;
  const activity = wb.activity.filter((a) => a.registrationNo === id).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.id.localeCompare(a.id));
  return { record, activity, related: relatedRecords(wb, record) };
}

/** Write edited cells on one row. Only the dashboard's writable columns are accepted. */
export async function saveProspectRecord(
  kind: ProspectKind,
  id: string,
  patch: Record<string, string | number | null>,
  invalidate: Invalidate,
  dealCtx: DealContext | null,
  /** Who is making the change, for the note an owner change leaves; blank when unknown. */
  by = "",
): Promise<ProspectResult> {
  const k = kindSchema.parse(kind);
  const clean = patchSchema.parse(patch);
  const unknown = Object.keys(clean).filter((c) => !WRITABLE[k].has(c));
  if (unknown.length) return { ok: false, message: `Not editable from the dashboard: ${unknown.join(", ")}.` };
  try {
    const rid = idSchema.parse(id);
    const { written, before } = await writeRecord(k, rid, clean, { by, today: todayIST() });
    if (written.includes("status")) await syncProspectDeal(dealCtx, { kind: k, id: rid, before, status: String(clean.status ?? "") });
    invalidate();
    return { ok: true, written, message: `Saved to the sheet: ${written.join(", ")}.` };
  } catch (err) {
    return { ok: false, message: errorMessage(err) };
  }
}

/** The most rows one bulk change writes. */
export const BULK_LIMIT = 50;

export type BulkResult = { ok: number; failed: { id: string; message: string }[]; message: string };

/**
 * Write the same cells on several rows of one kind, at most BULK_LIMIT, in one
 * batch (see writeRecords). Rows that fail are reported, not retried; the rest
 * are written. A status change still opens or moves each row's deal.
 */
export async function saveProspectRecords(
  kind: ProspectKind,
  ids: string[],
  patch: Record<string, string | number | null>,
  invalidate: Invalidate,
  dealCtx: DealContext | null,
  by = "",
): Promise<BulkResult> {
  const k = kindSchema.parse(kind);
  const clean = patchSchema.parse(patch);
  const unknown = Object.keys(clean).filter((c) => !WRITABLE[k].has(c));
  if (unknown.length) return { ok: 0, failed: [], message: `Not editable from the dashboard: ${unknown.join(", ")}.` };
  const list = ids.slice(0, BULK_LIMIT);
  try {
    list.forEach((id) => idSchema.parse(id));
    const results = await writeRecords(k, list, clean, { by, today: todayIST() });
    const failed: BulkResult["failed"] = [];
    let ok = 0;
    for (const r of results) {
      if (!r.ok) {
        failed.push({ id: r.id, message: r.message });
        continue;
      }
      ok++;
      if (r.written.includes("status")) await syncProspectDeal(dealCtx, { kind: k, id: r.id, before: r.before, status: String(clean.status ?? "") });
    }
    if (ok) invalidate();
    return { ok, failed, message: failed.length ? `${ok} saved; ${failed.length} failed: ${failed[0].message}` : `Saved ${ok} to the sheet.` };
  } catch (err) {
    return { ok: 0, failed: list.map((id) => ({ id, message: errorMessage(err) })), message: errorMessage(err) };
  }
}

/** Assign rows to a member, by their first name as the team writes it. At most 50 at a time. */
/** `by` is who is assigning; it defaults to the assignee (taking records for yourself). */
export async function assignProspects(kind: ProspectKind, ids: string[], memberName: string, invalidate: Invalidate, by = memberName): Promise<ProspectResult> {
  const name = firstName(memberName);
  const res = await saveProspectRecords(kind, ids, { assigned: name }, invalidate, null, by);
  if (res.failed.length) return { ok: false, message: `${res.ok} assigned; ${res.failed.length} failed: ${res.failed[0]?.message ?? res.message}` };
  if (!res.ok) return { ok: false, message: res.message };
  return { ok: true, written: ["assigned"], message: `Assigned ${res.ok} to ${name}.` };
}

/**
 * Log a call, message or meeting: updates the row (status, last_contacted,
 * next step, what was learnt, a dated line at the top of notes) and appends
 * one row to Activity, which is where the history and the stats come from.
 */
export async function logProspectTouch(input: TouchInput, by: string, invalidate: Invalidate, dealCtx: DealContext | null): Promise<ProspectResult> {
  const t = touchSchema.parse(input);
  const today = todayIST();
  const patch = touchPatch(t, by, today);
  try {
    // The change context lets a touch that moves an unowned record's status assign it to `by`.
    const { written, before } = await writeRecord(t.kind, t.id, patch, { by, today });
    // Straight after the row write: if Activity then fails and the touch is
    // retried, the status will already read as written and the retry would
    // see no change to sync.
    await syncProspectDeal(dealCtx, { kind: t.kind, id: t.id, before, status: t.statusAfter });
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
    return { ok: true, written: [...written, `Activity ${activityId}`], activityId, message: `Saved to the sheet: ${written.join(", ")} · Activity ${activityId}.` };
  } catch (err) {
    return { ok: false, message: errorMessage(err) };
  }
}

export type AddLeadResult = { ok: true; id: string; message: string } | { ok: false; message: string; duplicates?: DuplicateMatch[] };

/**
 * Add a prospect who came to us on LinkedIn. Refuses (with the matches) when
 * the profile link, email or phone is already on any tab, unless `force` —
 * the person adding may know it's a namesake, or want a separate lead anyway.
 */
export async function addLinkedInLead(input: NewLeadInput, by: string, invalidate: Invalidate): Promise<AddLeadResult> {
  const parsed = newLeadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  const lead = { ...parsed.data, assigned: firstName(parsed.data.assigned || by) };
  try {
    if (!lead.force) {
      const wb = await loadWorkbook();
      const dupes = findDuplicates(lead, PROSPECT_KINDS.flatMap((k) => recordsOf(wb, k)));
      if (dupes.length) return { ok: false, message: duplicateMessage(dupes), duplicates: dupes.slice(0, 5) };
    }
    const id = await appendLinkedInLead(lead, by, todayIST());
    invalidate();
    return { ok: true, id, message: `Added ${lead.name} as ${id}.` };
  } catch (err) {
    return { ok: false, message: errorMessage(err) };
  }
}
