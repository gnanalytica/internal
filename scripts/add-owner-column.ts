import { config } from "dotenv";
config({ path: ".env.local" });

import { discoverLayouts } from "../src/lib/sheet-crm/sync";
import { a1, columnLetter } from "../src/lib/sheet-crm/mapping";
import { getAccessToken } from "../src/lib/sheet-crm/google-auth";
import { listTabs, readRange, writeCells } from "../src/lib/sheet-crm/sheets-api";

/**
 * Add the Internal-owned `owner` header to People and Companies.
 *
 * Appends ONE column past the last non-empty header. It never renames, moves
 * or overwrites an existing column: it no-ops when `owner` is already there
 * and refuses when the target cell is occupied. Both tabs are exactly full
 * (48 and 33 columns), so the grid is widened first — `values.batchUpdate`
 * cannot write outside the declared grid.
 *
 * `pnpm exec tsx scripts/add-owner-column.ts` prints the plan; `--apply` runs it.
 */
const APPLY = process.argv.includes("--apply");
const TARGETS = ["people", "companies"] as const;

async function widen(spreadsheetId: string, sheetId: number, by: number) {
  const token = await getAccessToken();
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ appendDimension: { sheetId, dimension: "COLUMNS", length: by } }] }),
  });
  if (!res.ok) throw new Error(`appendDimension → ${res.status}: ${(await res.text()).slice(0, 400)}`);
}

async function main() {
  const id = process.env.VALYTICA_CRM_SHEET_ID;
  if (!id) throw new Error("VALYTICA_CRM_SHEET_ID is not set.");
  const { layouts } = await discoverLayouts(id);
  const tabs = await listTabs(id);

  for (const tab of TARGETS) {
    const l = layouts.get(tab);
    if (!l) { console.log(`✗ ${tab}: tab not found`); continue; }
    const meta = tabs.find((t) => t.title === l.title)!;
    const headers = l.headers.map((h) => String(h ?? ""));
    const existing = headers.findIndex((h) => h.trim().toLowerCase() === "owner");
    if (existing >= 0) {
      console.log(`· ${tab} ("${l.title}"): already has "owner" at ${columnLetter(existing)} — nothing to do`);
      continue;
    }
    let last = headers.length - 1;
    while (last >= 0 && headers[last].trim() === "") last--;
    const col = last + 1;
    const range = a1(l.title, l.headerRow0, col);
    const needsWidening = col >= meta.columnCount;

    console.log(
      `${APPLY ? "→" : "would"} ${tab} ("${l.title}"): ${headers.length} headers, last is "${headers[last]}" (${columnLetter(last)}), ` +
      `grid is ${meta.columnCount} cols${needsWidening ? ` → widen by ${col - meta.columnCount + 1}` : ""} → write "owner" to ${range}`,
    );
    if (!APPLY) continue;

    if (needsWidening) await widen(id, meta.sheetId, col - meta.columnCount + 1);
    const current = await readRange(id, range);
    const occupant = String(current?.[0]?.[0] ?? "").trim();
    if (occupant) { console.log(`  ✗ ${range} holds "${occupant}" — refusing to overwrite`); continue; }
    await writeCells(id, [{ range, value: "owner" }]);
    const after = await readRange(id, range);
    console.log(`  ✓ ${range} = "${String(after?.[0]?.[0] ?? "")}"`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
