/**
 * Find People rows that are not one person.
 *
 * Three shapes, and they are counted as valuers in every number the product
 * reports:
 *   FIRM        — a company sitting in People. `GHOSH SURVEYORS AND VALUERS PVT
 *                 LTD` is a row on the valuer list. README rule 6 says a firm
 *                 is not a person; this finds the rows that broke it.
 *   MULTI       — several people in one row. `1.Nisith Kumar Dutta 2.Hirak
 *                 Sarkar 3.Shyam Sunder Mitra 4.Suchandrika Das` is ONE row,
 *                 so four valuers are counted as one and none is contactable.
 *   UNUSABLE    — a name and nothing else: no IBBI number, no email, no phone,
 *                 no address. README rule 5: a row you cannot contact, cannot
 *                 deduplicate and cannot verify.
 *
 * It reports only. Which of these is a firm to move, a row to split, and a
 * mangled name to retype is a judgement call per row, and a wrong guess here
 * writes a person out of the dataset.
 *
 * `pnpm sheet:audit-row-shape`
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { readRange } from "../src/lib/sheet-crm/sheets-api";

const c = (v: unknown) => (v ?? "").toString().trim();

/** Words that only ever appear in an organisation's name. */
const FIRM_WORDS =
  /\b(pvt|private|limited|ltd|llp|inc|corporation|associates|consultants?|enterprises?|engineers?\s*&|&\s*co|company|firm|valuers\s*(pvt|private|and|&)|technologies|solutions|services|advisors?y?|group)\b/i;
/** A row naming several people: "1.A 2.B", "A and B", "A, B & C". */
const MULTI = /\d\s*[.)]\s*\S+.*\d\s*[.)]\s*\S+|\b\w+\s+and\s+\w+\s+(and|&)\s+\w+/i;
/** A name mangled by a bad split: leading punctuation, or "2)" mid-string. */
const MANGLED = /^[)\].,;-]|\d\s*\)/;

async function main() {
  const spreadsheetId = process.env.VALYTICA_CRM_SHEET_ID;
  if (!spreadsheetId) throw new Error("VALYTICA_CRM_SHEET_ID is not set");

  const grid = await readRange(spreadsheetId, "'People'!A1:BZ6200");
  const h = (grid[0] ?? []).map(c);
  const at = (r: unknown[], n: string) => (h.indexOf(n) >= 0 ? c(r[h.indexOf(n)]) : "");
  const rows = grid.slice(1).map((r, i) => ({ r, row: i + 2 })).filter(({ r }) => at(r, "person_id"));

  const firm: typeof rows = [], multi: typeof rows = [], mangled: typeof rows = [], unusable: typeof rows = [];
  for (const rec of rows) {
    const name = at(rec.r, "full_name");
    if (FIRM_WORDS.test(name)) firm.push(rec);
    else if (MULTI.test(name)) multi.push(rec);
    else if (MANGLED.test(name)) mangled.push(rec);
    // Rule 5: contactable or verifiable by at least one of these.
    if (!at(rec.r, "ibbi_reg_no") && !at(rec.r, "email") && !at(rec.r, "phone") && !at(rec.r, "address")) unusable.push(rec);
  }

  const show = (label: string, list: typeof rows, limit = 12) => {
    console.log(`\n##### ${label} — ${list.length}`);
    list.slice(0, limit).forEach(({ r, row }) =>
      console.log(
        `  r${String(row).padStart(5)} ${at(r, "person_id").padEnd(8)} ${at(r, "full_name").slice(0, 52).padEnd(54)}` +
          `ibbi=${at(r, "ibbi_reg_no") ? "y" : "-"} email=${at(r, "email") ? "y" : "-"} phone=${at(r, "phone") ? "y" : "-"} firm="${at(r, "company_names").slice(0, 24)}"`,
      ),
    );
    if (list.length > limit) console.log(`  … and ${list.length - limit} more`);
  };

  console.log(`People: ${rows.length} rows`);
  show("FIRM-shaped name", firm);
  show("MULTIPLE people in one row", multi);
  show("MANGLED name (bad split)", mangled);
  show("UNUSABLE — no ibbi, email, phone or address", unusable, 8);

  const flagged = new Set([...firm, ...multi, ...mangled].map((x) => x.row));
  console.log(`\n${flagged.size} row(s) are not one contactable person by name shape.`);
  console.log(`${unusable.length} row(s) carry no way to contact or verify them.`);
  console.log(`\nReports only — which is a firm to move, a row to split and a name to retype is a per-row call.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
