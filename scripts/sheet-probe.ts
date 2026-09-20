import { config } from "dotenv";
config({ path: ".env.local" });

import { discoverLayouts } from "../src/lib/sheet-crm/sync";
import { headerDrift, TAB_SPECS } from "../src/lib/sheet-crm/mapping";
import { readTabs } from "../src/lib/sheet-crm/sheets-api";
import { isBlankRow } from "../src/lib/sheet-crm/parse";

/**
 * Phase 0 probe: read the live workbook through the service account and
 * print what the sync will see — every sheet, which spec it matched (by
 * header signature), the header row, formula columns, drift, row counts.
 * Read-only. Nothing is written to the sheet or the database.
 *
 * Usage: pnpm sheet:probe
 */
async function main() {
  const id = process.env.VALYTICA_CRM_SHEET_ID;
  if (!id) throw new Error("VALYTICA_CRM_SHEET_ID is not set.");
  const { layouts, unmatched } = await discoverLayouts(id);
  const values = await readTabs(id, [...layouts.values()].map((l) => l.title));
  for (const spec of TAB_SPECS) {
    const l = layouts.get(spec.id);
    if (!l) {
      console.log(`✗ ${spec.id.padEnd(24)} NOT FOUND (expected a tab titled like "${spec.expectedTitle}")`);
      continue;
    }
    const rows = (values.get(l.title) ?? []).slice(l.headerRow0 + 1).filter((r) => !isBlankRow(r));
    const drift = headerDrift(spec, l.headers);
    const formulas = [...l.formulaCols].map((i) => l.headers[i]).filter(Boolean);
    console.log(`✓ ${spec.id.padEnd(24)} "${l.title}"  header row ${l.headerRow0 + 1}  rows ${rows.length}`);
    if (formulas.length) console.log(`    formula columns: ${formulas.join(", ")}`);
    if (drift.missing.length) console.log(`    MISSING headers: ${drift.missing.join(", ")}`);
    if (drift.unknown.length) console.log(`    unknown headers (mirrored verbatim): ${drift.unknown.join(", ")}`);
    if (drift.optionalPresent.length) console.log(`    requested columns present: ${drift.optionalPresent.join(", ")}`);
  }
  if (unmatched.length) console.log(`\nignored sheets (no header signature matched): ${unmatched.join(" · ")}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
