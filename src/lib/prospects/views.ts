import { recordsOf, type ProspectRecord, type ProspectsWorkbook } from "./parse";
import { PROSPECT_KINDS, type ProspectKind } from "./schema";
import { inFocus, myTasks, toRow, type ProspectRow } from "./stats";

/**
 * Read models for the API: the same slices the web page renders, built from
 * the workbook with no session involved. Pure, so the shapes a phone receives
 * are tested rather than trusted.
 */

export type Scope = "focus" | "all";

export const parseScope = (v: string | null | undefined): Scope => (v === "all" ? "all" : "focus");

export function parseKind(v: string | null | undefined): ProspectKind | null {
  return (PROSPECT_KINDS as readonly string[]).includes(v ?? "") ? (v as ProspectKind) : null;
}

/** One kind's rows, as the web's list shows them: focus states only unless the scope is all India. */
export function scopedRows(wb: ProspectsWorkbook, kind: ProspectKind, scope: Scope): ProspectRow[] {
  return recordsOf(wb, kind)
    .filter((r) => scope === "all" || inFocus(r))
    .map(toRow);
}

/** Rows in scope per kind (the switch's counts) and before the state filter (the "All India" count). */
export function kindCounts(wb: ProspectsWorkbook, scope: Scope): { counts: Record<ProspectKind, number>; totals: Record<ProspectKind, number> } {
  const counts = {} as Record<ProspectKind, number>;
  const totals = {} as Record<ProspectKind, number>;
  for (const k of PROSPECT_KINDS) {
    const all = recordsOf(wb, k);
    totals[k] = all.length;
    counts[k] = scope === "all" ? all.length : all.filter(inFocus).length;
  }
  return { counts, totals };
}

/** Every kind's rows in scope, which is what a person's queue is drawn from. */
export function everyRow(wb: ProspectsWorkbook, scope: Scope): ProspectRow[] {
  return PROSPECT_KINDS.flatMap((k) => scopedRows(wb, k, scope));
}

export type MyWorkItem = {
  reason: "overdue" | "today" | "new";
  row: ProspectRow;
  /** What the phone needs to act without opening the record: the drafts and the ways to reach them. */
  drafts: ProspectRecord["drafts"];
  phone: string;
  email: string;
  pitchAngle: string;
  lenders: number;
  casesPerMonth: number | null;
  software: string;
};

/** A person's queue for today (myTasks), each task carrying its drafts and contact details. */
export function myWork(wb: ProspectsWorkbook, person: string, today: string, scope: Scope): MyWorkItem[] {
  const byKey = new Map<string, ProspectRecord>();
  for (const k of PROSPECT_KINDS) for (const r of recordsOf(wb, k)) byKey.set(`${k}:${r.id}`, r);
  return myTasks(everyRow(wb, scope), person, today).map(({ row, reason }) => {
    const r = byKey.get(`${row.kind}:${row.id}`)!;
    return { reason, row, drafts: r.drafts, phone: r.phone, email: r.email, pitchAngle: r.pitchAngle, lenders: r.lenders.length, casesPerMonth: r.casesPerMonth, software: r.software };
  });
}
