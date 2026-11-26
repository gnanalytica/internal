import { bandKey, displayDate, isDoNotContact, stageIndex } from "./parse";
import { ACTIVITY_COLUMNS, DATE_COLUMNS, NUMBER_COLUMNS, WRITABLE, type ProspectKind } from "./schema";
import { addDays } from "./stats";

/**
 * A change to one row. `prependNote` adds a dated line to the top of `notes`,
 * which is a log (newest first), without overwriting what is already there.
 */
export type CellPatch = Record<string, string | number | null> & { prependNote?: string };

export type PlannedCell = { range: string; value: string | number | null };

export const quoteTab = (title: string) => `'${title.replace(/'/g, "''")}'`;

export function colLetter(i: number): string {
  let s = "";
  for (let n = i; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(65 + (n % 26)) + s;
  return s;
}

/**
 * Pure planning step for a row write: resolves each column by header, and
 * refuses anything the dashboard must not touch. Kept free of I/O so the
 * rules are testable.
 */
export function planRowWrite(input: {
  kind: ProspectKind;
  tab: string;
  header: unknown[];
  row: number;
  current: unknown[];
  formulas: Set<number>;
  patch: CellPatch;
}): { raw: PlannedCell[]; entered: PlannedCell[]; written: string[]; refused: string[] } {
  const { kind, tab, header, row, current, formulas, patch } = input;
  const col = (name: string) => header.findIndex((h) => String(h ?? "").trim() === name);
  const raw: PlannedCell[] = [];
  const entered: PlannedCell[] = [];
  const written: string[] = [];
  const refused: string[] = [];
  const cell = (i: number) => `${quoteTab(tab)}!${colLetter(i)}${row}`;

  const entries = Object.entries(patch).filter(([k]) => k !== "prependNote");
  if (patch.prependNote) {
    const i = col("notes");
    const existing = i >= 0 ? String(current[i] ?? "").trim() : "";
    const line = String(patch.prependNote).trim();
    entries.push(["notes", existing ? `${line}\n${existing}` : line]);
  }

  for (const [name, value] of entries) {
    if (!WRITABLE[kind].has(name)) {
      refused.push(`${name} is not editable from the dashboard`);
      continue;
    }
    const i = col(name);
    if (i < 0) {
      refused.push(`${tab} has no ${name} column`);
      continue;
    }
    if (formulas.has(i)) {
      refused.push(`${name} holds a formula`);
      continue;
    }
    const v = value === null || value === undefined ? "" : value;
    if (DATE_COLUMNS.has(name) && v !== "") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) {
        refused.push(`${name} must be a yyyy-mm-dd date`);
        continue;
      }
      entered.push({ range: cell(i), value: v });
    } else if (NUMBER_COLUMNS.has(name) && v !== "") {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) {
        refused.push(`${name} must be a number`);
        continue;
      }
      entered.push({ range: cell(i), value: n });
    } else {
      raw.push({ range: cell(i), value: v });
    }
    written.push(name);
  }
  return { raw, entered, written, refused };
}

/** Who is making a change and on what day (yyyy-mm-dd, India time), for the notes it leaves. */
export type ChangeContext = { by: string; today: string };

const sameOwner = (a: string, b: string) => {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  return x === y || (Boolean(x) && Boolean(y) && x.split(/\s+/)[0] === y.split(/\s+/)[0]);
};

/**
 * What changing `assigned` adds to a row, so ownership holds up over time:
 *
 * - a dated line at the top of notes ("18-11-2026 — Assigned to Parv (was
 *   Tasleem) by Sandeep"), so who took or gave a record, and when, stays on it;
 * - a follow-up tomorrow when the record is still open and has no date, so a
 *   new owner sees it in Your day instead of it waiting unseen. Not for an
 *   A-band record nobody has contacted: Your day already lists those (up to
 *   ten) as first contacts, and a date would turn a share-out of fifty into
 *   fifty overdue items two days later.
 *
 * Nothing when the owner doesn't really change, or for a column this kind
 * can't write. Pure: it reads the row as it stands (`current`, by `header`).
 */
export function assignmentEffects(kind: ProspectKind, header: unknown[], current: unknown[], patch: CellPatch, ctx: ChangeContext): CellPatch {
  if (!("assigned" in patch)) return {};
  const col = (name: string) => header.findIndex((h) => String(h ?? "").trim() === name);
  const cell = (name: string) => (col(name) >= 0 ? String(current[col(name)] ?? "").trim() : "");
  const before = cell("assigned");
  const after = String(patch.assigned ?? "").trim();
  if (sameOwner(before, after)) return {};
  const can = (name: string) => WRITABLE[kind].has(name) && col(name) >= 0;
  const out: CellPatch = {};
  if (can("notes")) {
    const by = ctx.by.trim().split(/\s+/)[0];
    const was = before ? ` (was ${before})` : "";
    out.prependNote = `${displayDate(ctx.today)} — ${after ? `Assigned to ${after}` : "Unassigned"}${was}${by ? ` by ${by}` : ""}`;
  }
  const stage = stageIndex(String(patch.status ?? cell("status")));
  const firstContact = stage === 0 && bandKey(cell("score_band")) === "A" && !isDoNotContact(cell("research_notes"));
  if (after && stage < 5 && !firstContact && !("next_step_date" in patch) && !cell("next_step_date") && can("next_step_date")) out.next_step_date = addDays(ctx.today, 1);
  return out;
}

/**
 * Who should own a row nobody owns when its status changes: the person
 * changing it (first name, as the team writes `assigned`). Null when the row
 * already has an owner, the change sets the owner itself, the status doesn't
 * really change, or nobody is known to be acting. Pure.
 */
export function claimOnStatusChange(kind: ProspectKind, header: unknown[], current: unknown[], patch: CellPatch, ctx: ChangeContext): string | null {
  if (!("status" in patch) || "assigned" in patch || !WRITABLE[kind].has("assigned")) return null;
  const col = (name: string) => header.findIndex((h) => String(h ?? "").trim() === name);
  if (col("assigned") < 0 || String(current[col("assigned")] ?? "").trim()) return null;
  const before = col("status") >= 0 ? String(current[col("status")] ?? "").trim().toLowerCase() : "";
  if (before === String(patch.status ?? "").trim().toLowerCase()) return null;
  const by = ctx.by.trim().split(/\s+/)[0] ?? "";
  return by || null;
}

/**
 * A patch with the assignment rule applied; an existing note line stays first.
 * A status change on an unowned row first assigns it to whoever made the
 * change (see claimOnStatusChange), so the usual owner-change note follows.
 * An added cell whose column holds a formula is dropped, so the note or date
 * never gets the owner change itself refused.
 */
export function withAssignment(kind: ProspectKind, header: unknown[], current: unknown[], given: CellPatch, ctx: ChangeContext | undefined, formulas: Set<number> = new Set()): CellPatch {
  if (!ctx) return given;
  const col = (name: string) => header.findIndex((h) => String(h ?? "").trim() === name);
  const claim = claimOnStatusChange(kind, header, current, given, ctx);
  const patch = claim && !formulas.has(col("assigned")) ? { ...given, assigned: claim } : given;
  const extra = assignmentEffects(kind, header, current, patch, ctx);
  if (formulas.has(col("notes"))) delete extra.prependNote;
  if (formulas.has(col("next_step_date"))) delete extra.next_step_date;
  if (!Object.keys(extra).length) return patch;
  const note = [patch.prependNote, extra.prependNote].filter(Boolean).join("\n");
  return { ...extra, ...patch, ...(note ? { prependNote: note } : {}) };
}

export type NewActivity = {
  loggedAt: string;
  recordType: string;
  registrationNo: string;
  name: string;
  by: string;
  channel: string;
  direction: string;
  outcome: string;
  durationMin: number | null;
  statusAfter: string;
  summary: string;
};

/** A-000001, A-000002, … — one past the highest existing, never reused. */
export function nextActivityId(existing: string[]): string {
  const max = existing.reduce((m, v) => {
    const n = /^A-(\d+)$/.exec(v.trim());
    return n ? Math.max(m, Number(n[1])) : m;
  }, 0);
  return `A-${String(max + 1).padStart(6, "0")}`;
}

/** The row in the Activity tab's own column order, read from its header — unknown headers stay blank. */
export function activityRow(id: string, e: NewActivity, header: unknown[]): (string | number | null)[] {
  const byColumn: Record<(typeof ACTIVITY_COLUMNS)[number], string | number | null> = {
    activity_id: id,
    logged_at: e.loggedAt,
    record_type: e.recordType,
    registration_no: e.registrationNo,
    name: e.name,
    by: e.by,
    channel: e.channel,
    direction: e.direction,
    outcome: e.outcome,
    duration_min: e.durationMin,
    status_after: e.statusAfter,
    summary: e.summary,
  };
  const cols = header.length ? header.map((h) => String(h ?? "").trim()) : [...ACTIVITY_COLUMNS];
  return cols.map((c) => (c in byColumn ? (byColumn[c as keyof typeof byColumn] ?? "") : ""));
}
