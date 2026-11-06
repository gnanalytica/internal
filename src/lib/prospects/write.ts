import "server-only";

import { appendRows, formulaColumnsInRows, readRange, readRanges, writeCells } from "./sheets-api";
import { activityRow, colLetter, nextActivityId, planRowWrite, quoteTab, type CellPatch, type NewActivity } from "./plan";
import { ID_COLUMN, prospectsSheetId, TAB, type ProspectKind } from "./schema";

export type WriteResult = {
  written: string[];
  row: number;
  /** The row as it read just before this write, by header name — what changed is `before` vs the patch. */
  before: Record<string, string>;
};

/**
 * Write cells on one row, found by its registration number at write time.
 *
 * Every read is fresh — the header (columns move), the ID column (rows get
 * sorted), the formula columns (checked on row 2, where an ARRAYFORMULA
 * lives, and on the target row) — so a stale page can never write into the
 * wrong row or over a formula.
 */
export async function writeRecord(kind: ProspectKind, id: string, patch: CellPatch): Promise<WriteResult> {
  const sheet = prospectsSheetId();
  const tab = TAB[kind];
  const { header, ids, col: idCol } = await readHeaderAndKeys(sheet, tab, ID_COLUMN[kind]);
  const matches = ids.flatMap((v, i) => (v.trim() === id ? [i + 2] : []));
  if (matches.length !== 1) {
    throw new Error(matches.length ? `${id} is on ${matches.length} rows of ${tab}; fix the duplicate in the sheet first.` : `${id} is no longer in ${tab}.`);
  }
  const row = matches[0];
  // The row and the formula check (row 2 and the target row) only need the row
  // number, so they go out together; one formula call covers both rows.
  const [currentRows, formulas] = await Promise.all([
    readRange(sheet, `${quoteTab(tab)}!${row}:${row}`),
    formulaColumnsInRows(sheet, tab, [2, row]),
  ]);
  const current = currentRows[0] ?? [];
  // The rows can be re-sorted between reading the IDs and reading the row. The
  // row read just now is what the write lands on, so it must still be this id.
  if (String(current[idCol] ?? "").trim() !== id) {
    throw new Error(`${tab} changed while saving (rows moved); reload and try again.`);
  }

  const plan = planRowWrite({ kind, tab, header, row, current, formulas, patch });
  if (plan.refused.length) throw new Error(`Refused: ${plan.refused.join("; ")}.`);
  await writeCells(sheet, plan.raw, "RAW");
  await writeCells(sheet, plan.entered, "USER_ENTERED");
  const before: Record<string, string> = {};
  header.forEach((h, i) => {
    const name = String(h ?? "").trim();
    if (name && !(name in before)) before[name] = String(current[i] ?? "").trim();
  });
  return { written: plan.written, row, before };
}

/** Append one row to Activity, with the next permanent activity_id. */
export async function appendActivity(entry: NewActivity): Promise<string> {
  const sheet = prospectsSheetId();
  // A missing activity_id header falls back to column A, as before.
  const { header, ids: existing } = await readHeaderAndKeys(sheet, TAB.activity, "activity_id", 0);
  const id = nextActivityId(existing);
  await appendRows(sheet, TAB.activity, [activityRow(id, entry, header)]);
  return id;
}

/**
 * Where each tab's key column was last found, by tab. Only a hint: it lets the
 * header and the key column be read in one call, and the header from that same
 * call is checked against it, so a moved column costs one extra read, never a
 * wrong one.
 */
const keyColumnHint = new Map<string, number>();

/**
 * A tab's header row and its key column's values from row 2 down (untrimmed).
 * Throws when the header has no `keyName` column, unless `fallback` names the
 * column to use instead.
 */
async function readHeaderAndKeys(
  sheet: string,
  tab: string,
  keyName: string,
  fallback?: number,
): Promise<{ header: unknown[]; ids: string[]; col: number }> {
  const headerRange = `${quoteTab(tab)}!1:1`;
  const keyRange = (col: number) => `${quoteTab(tab)}!${colLetter(col)}2:${colLetter(col)}`;
  const toIds = (rows: unknown[][]) => rows.map((r) => String(r[0] ?? ""));
  const locate = (header: unknown[]) => {
    const found = header.findIndex((h) => String(h ?? "").trim() === keyName);
    if (found >= 0) return found;
    if (fallback !== undefined) return fallback;
    throw new Error(`${tab} has no ${keyName} column.`);
  };

  const hint = keyColumnHint.get(tab);
  if (hint !== undefined) {
    const [headerRows, keyRows] = await readRanges(sheet, [headerRange, keyRange(hint)]);
    const header = headerRows[0] ?? [];
    const col = locate(header);
    if (col === hint) return { header, ids: toIds(keyRows), col };
    // The column moved since last time: read it where it is now.
    keyColumnHint.set(tab, col);
    return { header, ids: toIds(await readRange(sheet, keyRange(col))), col };
  }

  const header = (await readRange(sheet, headerRange))[0] ?? [];
  const col = locate(header);
  keyColumnHint.set(tab, col);
  return { header, ids: toIds(await readRange(sheet, keyRange(col))), col };
}
