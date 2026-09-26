/**
 * Turn three hand-typed People columns into the formulas they always were.
 *
 * `source_count`, `num_empanelments` and `is_south_india` are each a pure
 * function of another column, and all three sit in the "always filled" band, so
 * they read like facts. They are not: measured over 5,611 live rows on
 * 2026-09-26, the stored value disagreed with its own derivation on 75, 67 and
 * 1 rows — 143 cells quietly stating the wrong number, because a researcher
 * enriched `sources` and left the count alone.
 *
 * The item-count formula was checked against the app's own semantics (split on
 * ";", trim, drop empties) over every live row before being written: zero
 * disagreements, so the simple separator count is exact here and no regex is
 * needed.
 *
 * Order matters and is the lesson from the #REF! incident this morning: an
 * ARRAYFORMULA will not expand over a cell that holds anything, so the column
 * is cleared to the bottom BEFORE the formula lands in row 2.
 *
 * `pnpm sheet:people-derived`; `--apply` writes.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "node:fs";

import { getAccessToken } from "../src/lib/sheet-crm/google-auth";
import { clearRanges, readRange, writeCells } from "../src/lib/sheet-crm/sheets-api";

const APPLY = process.argv.includes("--apply");
const TAB = "People";
const LAST_ROW = 6000;

/** Count of ";"-separated items in `col`, or 0 when blank. */
const items = (c: string) =>
  `IF(TRIM(${c}2:${c})="",0,LEN(TRIM(${c}2:${c}))-LEN(SUBSTITUTE(TRIM(${c}2:${c}),";",""))+1)`;

const SOUTH = ["andhra pradesh", "telangana", "karnataka", "tamil nadu", "kerala", "puducherry", "pondicherry"];

const TARGETS = [
  {
    column: "source_count",
    letter: "Y",
    from: "sources (X)",
    formula: `=ARRAYFORMULA(IF(A2:A="","",${items("X")}))`,
  },
  {
    column: "num_empanelments",
    letter: "R",
    from: "empanelled_with (Q)",
    formula: `=ARRAYFORMULA(IF(A2:A="","",${items("Q")}))`,
  },
  {
    column: "is_south_india",
    letter: "M",
    from: "state (K)",
    formula: `=ARRAYFORMULA(IF(A2:A="","",IF(REGEXMATCH(LOWER(TRIM(K2:K)),"^(${SOUTH.join("|")})$"),"Yes","No")))`,
  },
];

async function hasFormula(spreadsheetId: string, a1: string): Promise<string | null> {
  const token = await getAccessToken();
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?ranges=${encodeURIComponent(a1)}&includeGridData=true&fields=sheets.data.rowData.values.userEnteredValue`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`grid read ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = (await res.json()) as {
    sheets?: { data?: { rowData?: { values?: { userEnteredValue?: { formulaValue?: string } }[] }[] }[] }[];
  };
  return j.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0]?.userEnteredValue?.formulaValue ?? null;
}

async function main() {
  const spreadsheetId = process.env.VALYTICA_CRM_SHEET_ID;
  if (!spreadsheetId) throw new Error("VALYTICA_CRM_SHEET_ID is not set");

  const headers = ((await readRange(spreadsheetId, `'${TAB}'!A1:BZ1`))[0] ?? []).map((h) => String(h ?? "").trim());
  const snapshot: Record<string, string[]> = {};

  for (const t of TARGETS) {
    const idx = headers.indexOf(t.column);
    const letter = (() => {
      let n = idx, s = "";
      while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
      return s;
    })();
    if (letter !== t.letter) {
      throw new Error(`${t.column} is at ${letter}, not ${t.letter} — the columns moved; re-derive the formulas.`);
    }
    // Never overwrite a formula that is already there.
    const live = await hasFormula(spreadsheetId, `'${TAB}'!${t.letter}2`);
    if (live) {
      console.log(`${t.column.padEnd(18)} already a formula — skipping`);
      console.log(`   ${live}`);
      t.formula = "";
      continue;
    }
    const values = (await readRange(spreadsheetId, `'${TAB}'!${t.letter}2:${t.letter}${LAST_ROW}`)).map(
      (r) => (r[0] ?? "").toString(),
    );
    snapshot[t.column] = values;
    console.log(`${t.column.padEnd(18)} ${values.filter((v) => v !== "").length} hand-typed value(s) ← ${t.from}`);
    console.log(`   ${t.formula}`);
  }

  const todo = TARGETS.filter((t) => t.formula !== "");
  if (!todo.length) {
    console.log("\nAll three are already formulas. Nothing to do.");
    return;
  }
  if (!APPLY) {
    console.log(`\nDry run — would convert ${todo.length} column(s). Re-run with --apply.`);
    return;
  }

  mkdirSync("tmp", { recursive: true });
  const path = `tmp/people-derived-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(path, JSON.stringify(snapshot, null, 2));
  console.log(`\nsnapshot: ${path}`);

  for (const t of todo) {
    // Clear first: the array cannot expand over a cell that holds anything.
    await clearRanges(spreadsheetId, [`'${TAB}'!${t.letter}2:${t.letter}${LAST_ROW}`]);
    await writeCells(spreadsheetId, [{ range: `'${TAB}'!${t.letter}2`, value: t.formula }], "USER_ENTERED");
    console.log(`✓ ${t.column} converted`);
  }

  console.log("\nverification — first 6 rows:");
  for (const t of todo) {
    const out = (await readRange(spreadsheetId, `'${TAB}'!${t.letter}2:${t.letter}7`)).map((r) => (r[0] ?? "").toString());
    const bad = out.some((v) => v.startsWith("#"));
    console.log(`  ${t.column.padEnd(18)} ${JSON.stringify(out)}${bad ? "   *** ERROR VALUE ***" : ""}`);
    if (bad) process.exitCode = 1;
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
