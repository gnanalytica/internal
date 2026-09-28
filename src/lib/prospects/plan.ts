import { ACTIVITY_COLUMNS, DATE_COLUMNS, NUMBER_COLUMNS, WRITABLE, type ProspectKind } from "./schema";

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
