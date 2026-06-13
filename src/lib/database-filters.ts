import type { DatabaseField, DatabaseRow } from "@/lib/types";

export type SortDir = "asc" | "desc";

function values(row: DatabaseRow): Record<string, unknown> {
  return (row.values as Record<string, unknown>) ?? {};
}

function isEmpty(v: unknown): boolean {
  return v == null || v === "";
}

/** Concatenated, lowercased text of all of a row's values — used for search. */
export function rowText(row: DatabaseRow): string {
  return Object.values(values(row))
    .filter((v) => !isEmpty(v))
    .map((v) => String(v))
    .join(" ")
    .toLowerCase();
}

export function matchesQuery(row: DatabaseRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return rowText(row).includes(q);
}

export function filterRows(rows: DatabaseRow[], query: string): DatabaseRow[] {
  const q = query.trim();
  if (!q) return rows;
  return rows.filter((r) => matchesQuery(r, q));
}

/** Comparator for one field. Empty values always sort last, regardless of direction. */
export function compareRows(
  field: DatabaseField,
  dir: SortDir,
): (a: DatabaseRow, b: DatabaseRow) => number {
  const sign = dir === "asc" ? 1 : -1;
  return (a, b) => {
    const av = values(a)[field.id];
    const bv = values(b)[field.id];
    const ae = isEmpty(av);
    const be = isEmpty(bv);
    if (ae && be) return 0;
    if (ae) return 1;
    if (be) return -1;
    if (field.type === "number") return (Number(av) - Number(bv)) * sign;
    if (field.type === "checkbox") return ((av ? 1 : 0) - (bv ? 1 : 0)) * sign;
    return String(av).localeCompare(String(bv)) * sign;
  };
}

export function sortRows(
  rows: DatabaseRow[],
  field: DatabaseField | null,
  dir: SortDir,
): DatabaseRow[] {
  if (!field) return rows;
  return [...rows].sort(compareRows(field, dir));
}
