/**
 * Repair the People tab's five formula columns when a literal value has blocked
 * their ARRAYFORMULAs.
 *
 * A single ARRAYFORMULA in row 2 fills the whole column. Writing a value into
 * ANY cell of that column makes the array refuse to expand — Sheets replaces the
 * entire result with `#REF! (Array result was not expanded because it would
 * overwrite data in <cell>.)`. So one stray cell blanks the column for all
 * 5,600+ rows, and the blame message names only the first blocker.
 *
 * This script finds those cells and clears them, so the arrays recompute. It
 * refuses unless every row-2 formula is still exactly the one it was written
 * against — a changed formula means something else happened and clearing cells
 * below it would be guesswork.
 *
 * Values found are snapshotted to tmp/ first: they are somebody's research and
 * they are personal data, so they leave a copy but never the repo.
 *
 * `pnpm sheet:fix-formula-blockers`; `--apply` writes.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { mkdirSync, writeFileSync } from "node:fs";
import { getAccessToken } from "../src/lib/sheet-crm/google-auth";
import { clearRanges, readRange } from "../src/lib/sheet-crm/sheets-api";

const APPLY = process.argv.includes("--apply");

/**
 * Column NAME -> the exact ARRAYFORMULA row 2 must hold for the repair to be
 * safe. Keyed by name, not by letter: dropping four retired columns on
 * 2026-09-26 moved `duplicate_flag` from AT to AR, and a tool that hard-codes
 * letters is wrong the moment the sheet is tidied.
 */
/**
 * The expected row-2 formula for each computed column, written in terms of the
 * SOURCE COLUMN NAMES and resolved to letters from the live header row.
 *
 * It used to hardcode the letters (`K2:K` for state, `Q2:Q` for
 * `empanelled_with`). Deleting one column to the left of those shifts every one
 * of them, Sheets rewrites the live formulas correctly, and this script then
 * refused every column as "DIFFERS" — reporting a healthy sheet as broken at
 * exactly the moment you want a repair tool you can trust. Deleting
 * `ibbi_asset_class` (column D) on 2026-09-26 did that to all four at once.
 */
const EXPECTED: Record<string, { name: string; formula: (at: (header: string) => string) => string }> = {
  duplicate_flag: {
    name: "duplicate_flag",
    formula: (at) => {
      const dup = (h: string) => `(IF(${at(h)}2:${at(h)}<>"",COUNTIF(${at(h)}2:${at(h)},${at(h)}2:${at(h)})>1,FALSE))`;
      return `=ARRAYFORMULA(IF(${at("person_id")}2:${at("person_id")}="","",IF(${dup("ibbi_reg_no")}+${dup("email")}+${dup("phone")}>0,"DUPLICATE","UNIQUE")))`;
    },
  },
  // Converted from hand-typed values on 2026-09-26 (people-derived-columns.ts).
  // A writer that learned the sheet before then still fills these in, which is
  // exactly the blocker this script exists to clear.
  is_south_india: {
    name: "is_south_india",
    formula: (at) =>
      `=ARRAYFORMULA(IF(${at("person_id")}2:${at("person_id")}="","",IF(REGEXMATCH(LOWER(TRIM(${at("state")}2:${at("state")})),"^(andhra pradesh|telangana|karnataka|tamil nadu|kerala|puducherry|pondicherry)$"),"Yes","No")))`,
  },
  num_empanelments: {
    name: "num_empanelments",
    formula: (at) => countList(at, "person_id", "empanelled_with"),
  },
  source_count: {
    name: "source_count",
    formula: (at) => countList(at, "person_id", "sources"),
  },
};

/** Entries in a `;` list: separators + 1, and 0 for an empty cell. */
function countList(at: (header: string) => string, key: string, list: string): string {
  const L = `${at(list)}2:${at(list)}`;
  return `=ARRAYFORMULA(IF(${at(key)}2:${at(key)}="","",IF(TRIM(${L})="",0,LEN(TRIM(${L}))-LEN(SUBSTITUTE(TRIM(${L}),";",""))+1)))`;
}

/** Zero-based index -> column letter. */
function letterOf(index0: number): string {
  let n = index0, out = "";
  while (n >= 0) { out = String.fromCharCode(65 + (n % 26)) + out; n = Math.floor(n / 26) - 1; }
  return out;
}

/** Column letter -> zero-based index. */
function colIndex(letter: string): number {
  let n = 0;
  for (const ch of letter) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

const NAMES = Object.keys(EXPECTED);

/** Column name -> letter, read from the sheet at run time. */
let LETTER: Record<string, string> = {};
let COLS: string[] = [];
const TAB = "People";
const LAST_ROW = 6000;

async function readRow2Formulas(spreadsheetId: string): Promise<(string | null)[]> {
  const token = await getAccessToken();
  const range = `'${TAB}'!${LETTER[COLS[0]]}2:${LETTER[COLS[COLS.length - 1]]}2`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?ranges=${encodeURIComponent(range)}&includeGridData=true&fields=sheets.data.rowData.values.userEnteredValue`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`grid read ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as {
    sheets?: { data?: { rowData?: { values?: { userEnteredValue?: { formulaValue?: string } }[] }[] }[] }[];
  };
  const values = j.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values ?? [];
  // The range spans M2:AV2, so a value's position is its column offset from M —
  // not its position in COLS, which skips the 28 columns in between.
  const base = colIndex(LETTER[COLS[0]]);
  return COLS.map((c) => values[colIndex(LETTER[c]) - base]?.userEnteredValue?.formulaValue ?? null);
}

async function main() {
  const spreadsheetId = process.env.VALYTICA_CRM_SHEET_ID;
  if (!spreadsheetId) throw new Error("VALYTICA_CRM_SHEET_ID is not set");

  // Resolve every target column's letter from the live header row.
  const header = ((await readRange(spreadsheetId, `'${TAB}'!A1:BZ1`))[0] ?? []).map((h) => (h ?? "").toString().trim());
  const missingCols = NAMES.filter((n) => !header.includes(n));
  if (missingCols.length) {
    console.error(`People has no column named: ${missingCols.join(", ")}. Refusing.`);
    process.exit(1);
  }
  // Every header, not only the computed ones: the expected formulas name their
  // source columns (state, empanelled_with, sources, ibbi_reg_no, email, phone).
  LETTER = Object.fromEntries(header.map((h, i) => [h, letterOf(i)]).filter(([h]) => h));
  COLS = [...NAMES].sort((a, b) => header.indexOf(a) - header.indexOf(b));
  console.log(`columns: ${COLS.map((c) => `${c}=${LETTER[c]}`).join(", ")}\n`);

  const live = await readRow2Formulas(spreadsheetId);
  let safe = true;
  console.log("row 2 formulas:");
  COLS.forEach((c, i) => {
    const at = (header: string) => {
      const letter = LETTER[header];
      if (!letter) throw new Error(`People has no "${header}" column; the expected formulas cannot be built.`);
      return letter;
    };
    const expected = EXPECTED[c].formula(at);
    const ok = live[i] === expected;
    if (!ok) safe = false;
    console.log(`  ${LETTER[c].padEnd(3)} ${EXPECTED[c].name.padEnd(20)} ${ok ? "matches expected" : "DIFFERS — refusing"}`);
    if (!ok) {
      console.log(`     live:     ${live[i] ?? "(no formula)"}`);
      console.log(`     expected: ${expected}`);
    }
  });
  if (!safe) {
    console.error("\nAt least one formula is not the one this script was written against.");
    console.error("Clearing cells under a formula I do not recognise would be guesswork. Nothing written.");
    process.exit(1);
  }

  // The formula columns are no longer one contiguous block (M, R and Y joined
  // AR:AV), so read the full width once and index into it rather than issuing a
  // range read per column — the sheet's per-minute read quota is shared with a
  // live 15-minute cron.
  // ONLY a column whose array has actually collapsed is scanned.
  //
  // This is the trap: `readRange` returns displayed values, and a healthy
  // ARRAYFORMULA displays a value in every row — so scanning a working column
  // reports all 5,600 spilled cells as blockers. It read correctly the first
  // time only because every column was already #REF! and the rows below were
  // genuinely empty. A blocked column shows `#REF!` in row 2; a healthy one
  // does not, and has nothing to clear.
  const row2 = (await readRange(spreadsheetId, `'${TAB}'!A2:${LETTER[COLS[COLS.length - 1]]}2`))[0] ?? [];
  const blocked = COLS.filter((c) => (row2[colIndex(LETTER[c])] ?? "").toString().startsWith("#REF!"));
  console.log(
    `\nblocked columns: ${blocked.length ? blocked.map((c) => `${LETTER[c]} (${EXPECTED[c].name})`).join(", ") : "none — every array is expanding"}`,
  );
  if (!blocked.length) {
    console.log("Nothing to repair.");
    return;
  }

  const grid = await readRange(spreadsheetId, `'${TAB}'!A3:${LETTER[COLS[COLS.length - 1]]}${LAST_ROW}`);
  const idCol = grid.map((r) => [r[0]]);

  const blockers: { a1: string; row: number; personId: string; column: string; value: string }[] = [];
  grid.forEach((row, i) => {
    blocked.forEach((c) => {
      const value = (row[colIndex(LETTER[c])] ?? "").toString();
      if (value.trim() === "") return;
      blockers.push({
        a1: `'${TAB}'!${LETTER[c]}${i + 3}`,
        row: i + 3,
        personId: ((idCol[i] ?? [])[0] ?? "").toString(),
        column: EXPECTED[c].name,
        value,
      });
    });
  });

  console.log(`\nscanned rows 3-${grid.length + 2}: ${blockers.length} literal cell(s) blocking the arrays`);
  if (!blockers.length) {
    console.log("Nothing to clear. The columns are either healthy or broken for another reason.");
    return;
  }

  const byRow = new Map<number, typeof blockers>();
  for (const b of blockers) {
    if (!byRow.has(b.row)) byRow.set(b.row, []);
    byRow.get(b.row)!.push(b);
  }
  for (const [row, items] of [...byRow.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`\n  row ${row}  ${items[0].personId}`);
    for (const b of items) console.log(`     ${b.column.padEnd(20)} ${JSON.stringify(b.value)}`);
  }

  // The values are research findings about named individuals: keep a copy out of
  // the repo before discarding them from the sheet.
  mkdirSync("tmp", { recursive: true });
  const snapshot = `tmp/formula-blockers-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(snapshot, JSON.stringify(blockers, null, 2));
  console.log(`\nsnapshot: ${snapshot}`);

  if (!APPLY) {
    console.log("\nDry run. Re-run with --apply to clear these cells.");
    return;
  }

  await clearRanges(spreadsheetId, blockers.map((b) => b.a1));
  console.log(`cleared ${blockers.length} cell(s)`);

  // An array that still will not expand means a blocker outside the scanned
  // window, so confirm rather than assume.
  const check = await readRange(spreadsheetId, `'${TAB}'!A3:${LETTER[COLS[COLS.length - 1]]}12`);
  console.log("\nverification — rows 3-12 after the clear:");
  blocked.forEach((c) => {
    const filled = check.filter((r) => ((r[colIndex(LETTER[c])] ?? "").toString().trim() !== "")).length;
    const sample = ((check[0] ?? [])[colIndex(LETTER[c])] ?? "").toString().slice(0, 60);
    console.log(`  ${LETTER[c].padEnd(3)} ${EXPECTED[c].name.padEnd(20)} ${filled}/10 filled   ${JSON.stringify(sample)}`);
  });
  const stillRef = check.some((r) => r.some((v) => (v ?? "").toString().startsWith("#REF!")));
  if (stillRef) {
    console.error("\nStill #REF! — a blocker exists outside the scanned range. Widen LAST_ROW and re-run.");
    process.exit(1);
  }
  console.log("\nAll five arrays expanded.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
