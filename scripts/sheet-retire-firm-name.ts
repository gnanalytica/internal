/**
 * Fold `People.firm_name` into `company_names`, so the column can be deleted.
 *
 * `firm_name` (124 rows) is a smaller, dirtier copy of `company_names` (463).
 * 70 rows carry both and the two DISAGREE on 22 of them — on P00037 `firm_name`
 * holds a LinkedIn URL. Meanwhile `Companies.linked_person_ids` already names
 * 405 of the 517 people who have any practice column at all, so the
 * person↔firm relationship is modelled from the Companies side regardless.
 *
 * Two cases, handled differently on purpose:
 *   - 54 rows have `firm_name` and no `company_names` → the value MOVES.
 *   - 70 rows have both → `company_names` wins (it is the longer, cleaner,
 *     better-populated column), and a differing `firm_name` is appended to
 *     `remarks` rather than dropped, because a disagreement is a finding.
 *     Where the two agree, `firm_name` is simply redundant and is discarded.
 *
 * Run this, verify, THEN delete the column.
 *
 * `pnpm sheet:retire-firm-name`; `--apply` writes.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "node:fs";

import { readRange, writeCells } from "../src/lib/sheet-crm/sheets-api";

const APPLY = process.argv.includes("--apply");
const c = (v: unknown) => (v ?? "").toString().trim();
const L = (i: number) => {
  let n = i, s = "";
  while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
  return s;
};
/** Two spellings of one firm are one firm; compare on letters and digits only. */
const skeleton = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");

async function main() {
  const spreadsheetId = process.env.VALYTICA_CRM_SHEET_ID;
  if (!spreadsheetId) throw new Error("VALYTICA_CRM_SHEET_ID is not set");

  const grid = await readRange(spreadsheetId, "'People'!A1:BZ6200");
  const headers = (grid[0] ?? []).map(c);
  const ix = (h: string) => headers.indexOf(h);
  for (const h of ["person_id", "firm_name", "company_names", "remarks"]) {
    if (ix(h) < 0) throw new Error(`People has no "${h}" column; refusing.`);
  }

  const writes: { range: string; value: string }[] = [];
  let moved = 0, redundant = 0, disagreed = 0;
  const examples: string[] = [];

  grid.slice(1).forEach((r, i) => {
    const row = i + 2;
    const id = c(r[ix("person_id")]);
    if (!id) return;
    const firm = c(r[ix("firm_name")]);
    if (!firm) return;
    const company = c(r[ix("company_names")]);

    if (!company) {
      writes.push({ range: `'People'!${L(ix("company_names"))}${row}`, value: firm });
      moved++;
      if (examples.length < 4) examples.push(`  move      r${row} ${id} → company_names = ${JSON.stringify(firm.slice(0, 60))}`);
      return;
    }
    // company_names already holds a value. Is firm_name saying something else?
    const same = skeleton(company).includes(skeleton(firm)) || skeleton(firm).includes(skeleton(company));
    if (same) { redundant++; return; }
    const remarks = c(r[ix("remarks")]);
    writes.push({
      range: `'People'!${L(ix("remarks"))}${row}`,
      value: [remarks, `firm_name (retired column) said: ${firm}`].filter(Boolean).join(" | "),
    });
    disagreed++;
    if (examples.length < 8) examples.push(`  disagree  r${row} ${id} company_names=${JSON.stringify(company.slice(0, 40))} firm_name=${JSON.stringify(firm.slice(0, 40))}`);
  });

  console.log(`firm_name is set on ${moved + redundant + disagreed} row(s)`);
  console.log(`  ${moved} move into an empty company_names`);
  console.log(`  ${redundant} are the same firm already in company_names — discarded`);
  console.log(`  ${disagreed} disagree — appended to remarks so the conflict survives the deletion`);
  console.log(`\n${writes.length} cell write(s)\n`);
  examples.forEach((e) => console.log(e));

  if (!APPLY) { console.log("\nDry run. Nothing written. Re-run with --apply."); return; }

  mkdirSync("tmp", { recursive: true });
  const snap = `tmp/firm-name-before-retire-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(
    snap,
    JSON.stringify(
      grid.slice(1).filter((r) => c(r[ix("person_id")]) && c(r[ix("firm_name")])).map((r) => ({
        person_id: c(r[ix("person_id")]),
        firm_name: c(r[ix("firm_name")]),
        company_names: c(r[ix("company_names")]),
      })),
      null,
      2,
    ),
  );
  console.log(`\nsnapshot: ${snap}`);
  for (let i = 0; i < writes.length; i += 200) await writeCells(spreadsheetId, writes.slice(i, i + 200), "RAW");
  console.log(`wrote ${writes.length} cell(s)`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
