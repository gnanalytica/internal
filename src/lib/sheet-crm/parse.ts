import { createHash } from "node:crypto";

/**
 * Parsing rules for cell values as the workbook actually writes them. Read
 * side only: nothing here rewrites a sheet cell to a normalised form. The
 * sheet's spelling is the sheet's business; these give Internal something it
 * can filter, dial and sort on.
 */

/** `;`-separated multi-values (`email`, `sources`, `linked_person_ids`, …). */
export function splitMulti(v: string | null | undefined): string[] {
  if (!v) return [];
  return v
    .split(/;|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** First item of a multi-value cell, or null. */
export function firstOf(v: string | null | undefined): string | null {
  return splitMulti(v)[0] ?? null;
}

/**
 * Normalise an Indian phone to E.164 for matching and dialling. Returns null
 * for anything that is not a plausible Indian number (a bare local exchange
 * number, a toll-free code, prose). The displayed value stays as written.
 */
function oneNumber(token: string): string | null {
  const digits = token.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith("0") && /^[6-9]/.test(digits[1])) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits[2])) return `+${digits}`;
  return null;
}

/**
 * Normalise an Indian phone to E.164 for matching and dialling. Returns null
 * for anything that is not a plausible Indian MOBILE — a bare local exchange
 * number, an STD landline, a toll-free code, prose. The displayed value stays
 * as written; this is only for the dial and match paths.
 *
 * The whole string is tried first, so a number written with spaces
 * (`+91 88797 64119`) survives; only if that fails is it split, so a cell
 * holding a landline and then a mobile (`04552-251038, 9842111177`) or three
 * numbers separated by spaces still yields a reachable number. Phone coverage
 * is the scarcest thing in this dataset, so a cell we can parse is a lead we
 * can reach.
 */
export function toE164India(v: string | null | undefined): string | null {
  if (!v) return null;
  const whole = oneNumber(v);
  if (whole) return whole;
  for (const token of v.split(/[;,/\n]+|\s+|\bor\b|\band\b/i)) {
    const n = oneNumber(token);
    if (n) return n;
  }
  return null;
}

/** All phone numbers in a cell, E.164 where possible. */
export function phonesIn(v: string | null | undefined): string[] {
  if (!v) return [];
  const out: string[] = [];
  const whole = toE164India(v);
  if (whole) out.push(whole);
  for (const part of v.split(/[;,/\n]+|\s+|\bor\b|\band\b/i)) {
    const e = toE164India(part);
    if (e && !out.includes(e)) out.push(e);
  }
  return out;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5,
  jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

/**
 * Parse the date formats the workbook uses into ISO `YYYY-MM-DD`:
 * `08 Oct, 2018` / `11 August, 2025` (masters), `2026-09-19` (GTM tabs),
 * `13-02-2028` and `31.10.2025` (prose). Anything else → null.
 */
export function parseSheetDate(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/);
  if (m) {
    const mon = MONTHS[m[2].toLowerCase()];
    if (mon) return `${m[3]}-${String(mon).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  m = s.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

/** Lower-cased, trimmed enum value for filtering (`High`/`high` → `high`). */
export function normEnum(v: string | null | undefined): string | null {
  const s = (v ?? "").trim().toLowerCase();
  return s || null;
}

export function toInt(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Yes/No cells. Anything that states neither → null. */
export function toBool(v: string | null | undefined): boolean | null {
  const s = normEnum(v);
  if (s === "yes" || s === "y" || s === "true") return true;
  if (s === "no" || s === "n" || s === "false") return false;
  return null;
}

/**
 * The owner's convention for a bank-side People row (2026-09-20): a column
 * that STARTS with `INSTITUTIONAL` and ends `not a valuer`, followed by the
 * role. It was described as living in `specialisation` and actually landed in
 * `associations_and_roles`, so both are read — the convention is the prefix,
 * not the column. Blank IBBI / RVO fields are never used to infer this: plenty
 * of genuine valuers have them blank too.
 */
export const INSTITUTIONAL_MARKER_COLUMNS = ["associations_and_roles", "specialisation"] as const;

export function isInstitutionalSpecialisation(v: string | null | undefined): boolean {
  return /^\s*INSTITUTIONAL\b/.test(v ?? "");
}

export function isInstitutionalRow(record: Record<string, string>): boolean {
  return INSTITUTIONAL_MARKER_COLUMNS.some((c) => isInstitutionalSpecialisation(record[c]));
}

/** The role text after the INSTITUTIONAL marker, for display. */
export function institutionalRole(record: Record<string, string>): string | null {
  for (const c of INSTITUTIONAL_MARKER_COLUMNS) {
    const v = record[c] ?? "";
    if (isInstitutionalSpecialisation(v)) return v.replace(/^\s*INSTITUTIONAL\s*[—–-]*\s*/, "").trim() || null;
  }
  return null;
}

/** The exact-name key the workbook uses: lower-case, letters and digits only. */
export function normalizedNameKey(name: string | null | undefined): string {
  return (name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Stable hash of a row's raw cells, for change detection. */
export function rowHash(cells: unknown[]): string {
  return createHash("sha256").update(JSON.stringify(cells.map((c) => (c === undefined || c === null ? "" : String(c))))).digest("hex");
}

/** Cell → string exactly as the sheet shows it (numbers keep their digits, blanks are ""). */
export function cellString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return String(v);
}

/** Zip a header row and a data row into a record. Extra cells past the headers are dropped. */
export function rowToRecord(headers: string[], row: unknown[]): Record<string, string> {
  const rec: Record<string, string> = {};
  headers.forEach((h, i) => {
    if (h) rec[h] = cellString(row[i]);
  });
  return rec;
}

/** A row is blank when every cell is empty — the hand-edited tabs carry spacer rows. */
export function isBlankRow(row: unknown[]): boolean {
  return row.every((c) => cellString(c).trim() === "");
}
