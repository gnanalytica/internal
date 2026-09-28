import "server-only";

import { appendRows, formulaColumns, readRange, writeCells } from "./sheets-api";
import { activityRow, colLetter, nextActivityId, planRowWrite, quoteTab, type CellPatch, type NewActivity } from "./plan";
import { ID_COLUMN, prospectsSheetId, TAB, type ProspectKind } from "./schema";

export type WriteResult = { written: string[]; row: number };

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
  const header = (await readRange(sheet, `${quoteTab(tab)}!1:1`))[0] ?? [];
  const idCol = header.findIndex((h) => String(h ?? "").trim() === ID_COLUMN[kind]);
  if (idCol < 0) throw new Error(`${tab} has no ${ID_COLUMN[kind]} column.`);
  const ids = (await readRange(sheet, `${quoteTab(tab)}!${colLetter(idCol)}2:${colLetter(idCol)}`)).map((r) => String(r[0] ?? "").trim());
  const matches = ids.flatMap((v, i) => (v === id ? [i + 2] : []));
  if (matches.length !== 1) {
    throw new Error(matches.length ? `${id} is on ${matches.length} rows of ${tab}; fix the duplicate in the sheet first.` : `${id} is no longer in ${tab}.`);
  }
  const row = matches[0];
  const current = (await readRange(sheet, `${quoteTab(tab)}!${row}:${row}`))[0] ?? [];
  const formulas = new Set([...(await formulaColumns(sheet, tab, 0, 1)), ...(await formulaColumns(sheet, tab, row - 2, 1))]);

  const plan = planRowWrite({ kind, tab, header, row, current, formulas, patch });
  if (plan.refused.length) throw new Error(`Refused: ${plan.refused.join("; ")}.`);
  await writeCells(sheet, plan.raw, "RAW");
  await writeCells(sheet, plan.entered, "USER_ENTERED");
  return { written: plan.written, row };
}

/** Append one row to Activity, with the next permanent activity_id. */
export async function appendActivity(entry: NewActivity): Promise<string> {
  const sheet = prospectsSheetId();
  const header = (await readRange(sheet, `${quoteTab(TAB.activity)}!1:1`))[0] ?? [];
  const idCol = Math.max(0, header.findIndex((h) => String(h ?? "").trim() === "activity_id"));
  const existing = (await readRange(sheet, `${quoteTab(TAB.activity)}!${colLetter(idCol)}2:${colLetter(idCol)}`)).map((r) => String(r[0] ?? ""));
  const id = nextActivityId(existing);
  await appendRows(sheet, TAB.activity, [activityRow(id, entry, header)]);
  return id;
}
