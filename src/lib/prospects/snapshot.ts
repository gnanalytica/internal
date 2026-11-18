import { recordsOf, type ActivityEntry, type ProspectsWorkbook } from "./parse";
import { PROSPECT_KINDS, type ProspectKind } from "./schema";
import { toRow, type ProspectRow } from "./stats";

/**
 * What the list pages read from the sheet: every record as its list row, plus
 * Activity. Sales (its Customers tab too), the scorecard and the list API
 * need nothing else; the full record (notes, drafts, research) is read only
 * when one prospect is opened.
 */
export type ProspectsSnapshot = {
  rows: Record<ProspectKind, ProspectRow[]>;
  activity: ActivityEntry[];
  warnings: string[];
  readAt: string;
};

export function snapshotOf(wb: ProspectsWorkbook): ProspectsSnapshot {
  const rows = {} as Record<ProspectKind, ProspectRow[]>;
  for (const k of PROSPECT_KINDS) rows[k] = recordsOf(wb, k).map(toRow);
  return { rows, activity: wb.activity, warnings: wb.warnings, readAt: wb.readAt };
}

/**
 * The snapshot as it is stored in the shared cache: each row a plain array in
 * `keys` order. Repeating every field name on each of ~3,500 rows is most of
 * the weight (1.3 MB as objects, 0.55 MB as arrays), and the shared cache takes
 * at most 2 MB per entry.
 */
export type PackedSnapshot = Omit<ProspectsSnapshot, "rows"> & {
  keys: (keyof ProspectRow)[];
  rows: Record<ProspectKind, unknown[][]>;
};

export function packSnapshot(s: ProspectsSnapshot): PackedSnapshot {
  const first = PROSPECT_KINDS.map((k) => s.rows[k][0]).find(Boolean);
  const keys = (first ? Object.keys(first) : []) as (keyof ProspectRow)[];
  const rows = {} as Record<ProspectKind, unknown[][]>;
  for (const k of PROSPECT_KINDS) rows[k] = s.rows[k].map((r) => keys.map((key) => r[key]));
  return { ...s, keys, rows };
}

export function unpackSnapshot(p: PackedSnapshot): ProspectsSnapshot {
  const rows = {} as Record<ProspectKind, ProspectRow[]>;
  for (const k of PROSPECT_KINDS)
    rows[k] = (p.rows[k] ?? []).map((values) => {
      const r = {} as Record<string, unknown>;
      p.keys.forEach((key, i) => (r[key] = values[i]));
      return r as ProspectRow;
    });
  return { rows, activity: p.activity, warnings: p.warnings, readAt: p.readAt };
}
