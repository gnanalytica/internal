import { config } from "dotenv";
config({ path: ".env.local" });

import { a1 } from "../src/lib/sheet-crm/mapping";
import { getAccessToken } from "../src/lib/sheet-crm/google-auth";
import { writeCells } from "../src/lib/sheet-crm/sheets-api";
import { discoverLayouts } from "../src/lib/sheet-crm/sync";

/**
 * Repair the two People duplicate-detection formulas.
 *
 * `duplicate_flag` counted a repeated `company_names` as a duplicate, so two
 * valuers at the same firm flagged each other — 139 of the 221 flags were that
 * and nothing else. `match_rule` reported which column was POPULATED rather
 * than which rule fired, which is why 128 rows read "IBBI" while the tab holds
 * no repeated IBBI number at all.
 *
 * These are formula cells, the one thing nothing else in this repo writes, so
 * the script refuses unless each cell still holds exactly the formula it was
 * written against. `pnpm sheet:fix-dup-formulas`; `--apply` writes.
 */
const APPLY = process.argv.includes("--apply");

const DUP = `(IF(C2:C<>"",COUNTIF(C2:C,C2:C)>1,FALSE))+(IF(G2:G<>"",COUNTIF(G2:G,G2:G)>1,FALSE))+(IF(H2:H<>"",COUNTIF(H2:H,H2:H)>1,FALSE))`;

const TARGETS = [
  {
    column: "duplicate_flag",
    expected: `=ARRAYFORMULA(IF(A2:A="","",IF((IF(C2:C<>"",COUNTIF(C2:C,C2:C)>1,FALSE))+(IF(G2:G<>"",COUNTIF(G2:G,G2:G)>1,FALSE))+(IF(H2:H<>"",COUNTIF(H2:H,H2:H)>1,FALSE))+(IF(N2:N<>"",COUNTIF(N2:N,N2:N)>1,FALSE))>0,"DUPLICATE","UNIQUE")))`,
    next: `=ARRAYFORMULA(IF(A2:A="","",IF(${DUP}>0,"DUPLICATE","UNIQUE")))`,
    why: "drop the company_names clause — colleagues are not duplicates",
  },
  {
    column: "match_rule",
    expected: `=ARRAYFORMULA(IF(A2:A="","",IF(C2:C<>"","IBBI",IF(G2:G<>"","EMAIL",IF(H2:H<>"","PHONE",IF(N2:N<>"","COMPANY_NAME","NAME_ONLY"))))))`,
    next: `=ARRAYFORMULA(IF(A2:A="","",IF(AT2:AT<>"DUPLICATE","",IF(IF(C2:C<>"",COUNTIF(C2:C,C2:C)>1,FALSE),"IBBI",IF(IF(G2:G<>"",COUNTIF(G2:G,G2:G)>1,FALSE),"EMAIL",IF(IF(H2:H<>"",COUNTIF(H2:H,H2:H)>1,FALSE),"PHONE",""))))))`,
    why: "name the rule that actually fired, and say nothing on a row that is not a duplicate",
  },
  {
    column: "duplicate_match_ids",
    expected: `=ARRAYFORMULA(IF(A2:A="","",IF(AT2:AT="DUPLICATE","MATCH ON IBBI / EMAIL / PHONE / COMPANY — MERGE REQUIRED","")))`,
    next: `=ARRAYFORMULA(IF(A2:A="","",IF(AT2:AT="DUPLICATE","MATCH ON "&AV2:AV&" — MERGE REQUIRED","")))`,
    why: "stop naming COMPANY as a rule now that it is not one, and name the row's own rule",
  },
];

async function readFormula(spreadsheetId: string, range: string): Promise<string | null> {
  const token = await getAccessToken();
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?ranges=${encodeURIComponent(range)}&includeGridData=true&fields=sheets.data.rowData.values.userEnteredValue`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`read ${range} → ${res.status}`);
  const j = (await res.json()) as { sheets?: { data?: { rowData?: { values?: { userEnteredValue?: { formulaValue?: string } }[] }[] }[] }[] };
  return j.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0]?.userEnteredValue?.formulaValue ?? null;
}

async function main() {
  const id = process.env.VALYTICA_CRM_SHEET_ID;
  if (!id) throw new Error("VALYTICA_CRM_SHEET_ID is not set.");
  const people = (await discoverLayouts(id)).layouts.get("people");
  if (!people) throw new Error("People tab not found by its header signature.");

  const writes: { range: string; value: string }[] = [];
  for (const t of TARGETS) {
    const col = people.headers.findIndex((h) => String(h ?? "").trim() === t.column);
    if (col < 0) {
      console.log(`✗ ${t.column}: no such column`);
      continue;
    }
    const range = a1(people.title, people.headerRow0 + 1, col);
    const live = await readFormula(id, range);
    if (live === t.next) {
      console.log(`· ${t.column} (${range}): already repaired`);
      continue;
    }
    if (live !== t.expected) {
      console.log(`✗ ${t.column} (${range}): not the formula this script was written against — refusing.\n   live: ${String(live).slice(0, 160)}`);
      continue;
    }
    console.log(`${APPLY ? "→" : "would"} ${t.column} (${range}) — ${t.why}`);
    writes.push({ range, value: t.next });
  }

  if (!APPLY || !writes.length) {
    console.log(`\n${writes.length} formula(s) to repair.`);
    return;
  }
  // USER_ENTERED, or the formula is stored as literal text.
  await writeCells(id, writes, "USER_ENTERED");
  for (const w of writes) {
    const back = await readFormula(id, w.range);
    console.log(`   ${back === w.value ? "✓" : "✗"} ${w.range}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
