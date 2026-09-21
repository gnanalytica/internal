import { config } from "dotenv";
config({ path: ".env.local" });

import { a1, columnLetter } from "../src/lib/sheet-crm/mapping";
import { getAccessToken } from "../src/lib/sheet-crm/google-auth";
import { listTabs, readTabs, writeCells } from "../src/lib/sheet-crm/sheets-api";
import { discoverLayouts } from "../src/lib/sheet-crm/sync";

/**
 * Give Lender Contacts and Association Officers a stable id.
 *
 * Both are keyed today on a name-and-institution combination, so every one of
 * their rows syncs as `weakKey`: correct a spelling in any of those cells and
 * the pull sees a deleted row and a new one, and anything recorded against the
 * old key silently detaches. `mapping.ts` already declares `lender_contact_id`
 * / `officer_id` as the primary key with the name combination only as a
 * FALLBACK, so populating the column is the whole fix — no code change.
 *
 * Ids are assigned in current row order and never reused; an existing id is
 * never overwritten. `pnpm sheet:add-directory-ids`; `--apply` writes.
 */
const APPLY = process.argv.includes("--apply");

const TARGETS = [
  { tab: "lender_contacts" as const, column: "lender_contact_id", prefix: "L" },
  { tab: "association_officers" as const, column: "officer_id", prefix: "O" },
];

const cell = (v: unknown) => String(v ?? "").trim();

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

  for (const t of TARGETS) {
    const l = layouts.get(t.tab);
    if (!l) {
      console.log(`✗ ${t.tab}: tab not found`);
      continue;
    }
    const meta = tabs.find((m) => m.title === l.title)!;
    const headers = l.headers.map((h) => String(h ?? ""));
    let col = headers.findIndex((h) => h.trim().toLowerCase() === t.column);
    const headerWrite: { range: string; value: string }[] = [];

    if (col < 0) {
      let last = headers.length - 1;
      while (last >= 0 && headers[last].trim() === "") last--;
      col = last + 1;
      if (col >= meta.columnCount) {
        console.log(`   ${t.tab}: grid is ${meta.columnCount} cols — widen by ${col - meta.columnCount + 1}`);
        if (APPLY) await widen(id, meta.sheetId, col - meta.columnCount + 1);
      }
      headerWrite.push({ range: a1(l.title, l.headerRow0, col), value: t.column });
    } else if (l.formulaCols.has(col)) {
      console.log(`✗ ${t.tab}: ${columnLetter(col)} carries a formula — refusing`);
      continue;
    }

    const values = (await readTabs(id, [l.title])).get(l.title) ?? [];
    const used = new Set<string>();
    for (let r = l.headerRow0 + 1; r < values.length; r++) {
      const v = cell(values[r]?.[col]);
      if (v) used.add(v);
    }

    const writes = [...headerWrite];
    let n = 0;
    let kept = 0;
    for (let r = l.headerRow0 + 1; r < values.length; r++) {
      const row = values[r] ?? [];
      // A row with nothing in it is spreadsheet padding, not a record.
      if (!row.some((c) => cell(c))) continue;
      if (cell(row[col])) {
        kept++;
        continue;
      }
      let next: string;
      do {
        next = `${t.prefix}${String(++n).padStart(5, "0")}`;
      } while (used.has(next));
      used.add(next);
      writes.push({ range: a1(l.title, r, col), value: next });
    }

    console.log(
      `${APPLY ? "→" : "would"} ${t.tab} ("${l.title}"): ${headerWrite.length ? `add "${t.column}" at ${columnLetter(col)}, ` : `${t.column} already at ${columnLetter(col)}, `}` +
        `assign ${writes.length - headerWrite.length} ids${kept ? `, keep ${kept} existing` : ""}`,
    );
    if (!APPLY) continue;

    for (let i = 0; i < writes.length; i += 200) await writeCells(id, writes.slice(i, i + 200), "RAW");
    const after = (await readTabs(id, [l.title])).get(l.title) ?? [];
    let filled = 0;
    let rows = 0;
    for (let r = l.headerRow0 + 1; r < after.length; r++) {
      const row = after[r] ?? [];
      if (!row.some((c) => cell(c))) continue;
      rows++;
      if (cell(row[col])) filled++;
    }
    console.log(`   ✓ ${filled}/${rows} rows carry an id`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
