/**
 * Take the row ceiling out of the Summary tab's formulas.
 *
 * Every one of its 27 formulas is bounded — `COUNTA(People!A2:A5604)` — against
 * a tab that has 5,611 data rows ending at spreadsheet row 5612. So the eight
 * most recently added people are counted by NOTHING on that tab: not the
 * headline total, not the contactability or qualification counts, not the state
 * breakdown, not the empanelment counts. The number is wrong in the direction
 * that looks plausible, and it drifts further every time the hourly bot appends
 * a row. Companies is bounded at 351 against 350 rows — one row from the same
 * failure.
 *
 * The fix is to stop bounding: `People!A2:A` is open-ended, and COUNTA, COUNTIF,
 * COUNTIFS, MAX and AVERAGE all accept it (AVERAGE ignores the blanks). There is
 * then no number to maintain.
 *
 * Writes with USER_ENTERED, or the formula would be stored as the literal text
 * of itself.
 *
 * It also resolves every reference to the HEADER it currently lands on
 * (`People!K` -> `state`), which is the check to run after any column deletion:
 * Sheets rewrites A1 references when a column is removed, and this is how you
 * confirm it did rather than assume it. A reference resolving to a blank header,
 * or to a column that plainly does not match the row's label, means a formula
 * is now counting the wrong thing — and it will still return a number.
 *
 * `pnpm sheet:unbound-summary`; `--apply` writes.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "node:fs";

import { getAccessToken } from "../src/lib/sheet-crm/google-auth";
import { readRange, writeCells } from "../src/lib/sheet-crm/sheets-api";

const APPLY = process.argv.includes("--apply");
const TAB = "Summary";

/**
 * `People!A2:A5604` -> `People!A2:A`, for a range starting at ANY row.
 *
 * An earlier version anchored the start row to 2, which silently skipped the
 * three formulas over tabs that carry a title banner and so start at row 3:
 * `'IOV Memberships'!H3:H2728` and two over `'Lender Contacts'!…380`. Both of
 * those tabs sit EXACTLY on their bound today, so the next row appended to
 * either would have gone uncounted — the same failure, one row away.
 *
 * A single-cell reference has no `:` and is untouched.
 */
const unbound = (f: string) => f.replace(/('?[A-Za-z ]+'?!)(\$?[A-Z]{1,3})(\$?\d+):(\$?[A-Z]{1,3})\$?\d+/g, "$1$2$3:$4");

async function main() {
  const spreadsheetId = process.env.VALYTICA_CRM_SHEET_ID;
  if (!spreadsheetId) throw new Error("VALYTICA_CRM_SHEET_ID is not set");

  const token = await getAccessToken();
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?ranges='${TAB}'!A1:H60&includeGridData=true&fields=sheets(data(rowData(values(userEnteredValue))))`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`read → ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const rowData: { values?: { userEnteredValue?: { formulaValue?: string } }[] }[] =
    (await res.json()).sheets[0].data[0].rowData ?? [];

  const letter = (i: number) => {
    let n = i, s = "";
    while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
    return s;
  };

  // Resolve references against the live header rows of both master tabs.
  const headersOf = async (tab: string) =>
    ((await readRange(spreadsheetId, `'${tab}'!A1:BZ1`))[0] ?? []).map((h) => (h ?? "").toString().trim());
  const liveHeaders: Record<string, string[]> = {
    People: await headersOf("People"),
    Companies: await headersOf("Companies"),
  };
  const colIndex = (letter: string) => letter.split("").reduce((a, ch) => a * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
  const resolve = (formula: string) => {
    const seen = new Map<string, string>();
    for (const m of formula.matchAll(/(People|Companies)!\$?([A-Z]{1,3})\$?\d*/g)) {
      const [, tab, letter] = m;
      const name = liveHeaders[tab]?.[colIndex(letter)] ?? "";
      seen.set(`${tab}!${letter}`, name || "*** NO HEADER ***");
    }
    for (const m of formula.matchAll(/'([^']+)'!\$?([A-Z]{1,3})\$?\d*/g)) {
      const [, tab, letter] = m;
      if (liveHeaders[tab]) continue;
      seen.set(`${tab}!${letter}`, "(not a master tab — header not checked)");
    }
    return [...seen.entries()].map(([ref, name]) => `${ref}=${name}`).join("  ");
  };

  const changes: { range: string; before: string; value: string }[] = [];
  let unchanged = 0;
  rowData.forEach((r, ri) => {
    (r.values ?? []).forEach((cell, ci) => {
      const f = cell?.userEnteredValue?.formulaValue;
      if (!f) return;
      const next = unbound(f);
      if (next === f) { unchanged++; return; }
      changes.push({ range: `'${TAB}'!${letter(ci)}${ri + 1}`, before: f, value: next });
    });
  });

  console.log(`${changes.length + unchanged} formula(s) on ${TAB}; ${changes.length} carry a row ceiling\n`);
  let unresolved = 0;
  for (const c of changes) {
    const refs = resolve(c.value);
    if (refs.includes("NO HEADER")) unresolved++;
    console.log(`  ${c.range.split("!")[1].padEnd(5)} ${c.before}`);
    console.log(`        → ${c.value}`);
    console.log(`          ${refs}`);
  }
  if (unresolved) {
    throw new Error(
      `${unresolved} formula(s) reference a column with no header — a deletion shifted them and Sheets did not rewrite the reference. Fix those before unbinding.`,
    );
  }
  if (unchanged) console.log(`\n  ${unchanged} formula(s) already open-ended or single-cell — untouched`);

  if (!changes.length) { console.log("\nNothing to do."); return; }
  if (!APPLY) { console.log("\nDry run. Nothing written. Re-run with --apply."); return; }

  mkdirSync("tmp", { recursive: true });
  const snap = `tmp/summary-formulas-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(snap, JSON.stringify(changes, null, 2));
  console.log(`\nsnapshot: ${snap}`);

  await writeCells(spreadsheetId, changes.map((c) => ({ range: c.range, value: c.value })), "USER_ENTERED");
  console.log(`rewrote ${changes.length} formula(s)`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
