/**
 * Delete the four People columns that nothing reads.
 *
 *   canonical_entity_key   normalized_name_key   match_rule   duplicate_match_ids
 *
 * The first three appear in the codebase only in `mapping.ts` / `fields.ts` —
 * the sync's list of columns that exist. No consumer reads the values; they are
 * machine scratch space for a duplicate check that is now done by a reviewed
 * pair list in `scripts/merged-pairs.ts` and by the app.
 *
 * `duplicate_match_ids` is worse than unread. Its formula emits
 * "MATCH ON <rule> — MERGE REQUIRED", and `queries.ts` runs a data-quality
 * check for exactly that column holding "text, not an id" — so the sheet
 * manufactures a permanent complaint about itself, on every flagged row.
 *
 * `duplicate_flag` stays: it is the one dedupe column with a real consumer
 * (`crmContacts.sheetDuplicate`, the "dup" chip and a filter).
 *
 * Deleting shifts every column to the right, so this prints the resulting
 * layout and verifies the survivors by NAME afterwards rather than trusting an
 * arithmetic guess about the new letters.
 *
 * `pnpm sheet:drop-dead-columns`; `--apply` writes.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "node:fs";

import { getAccessToken } from "../src/lib/sheet-crm/google-auth";
import { listTabs, readRange } from "../src/lib/sheet-crm/sheets-api";

const APPLY = process.argv.includes("--apply");
const TAB = "People";

const DROP = ["canonical_entity_key", "normalized_name_key", "match_rule", "duplicate_match_ids"] as const;
/** Checked by name after the deletion — these must survive. */
const MUST_SURVIVE = ["person_id", "full_name", "duplicate_flag", "owner", "is_institutional", "persona"] as const;

const cell = (v: unknown) => (v ?? "").toString();

function colLetter(index0: number): string {
  let n = index0,
    s = "";
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function retry<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 5; i++) {
    try {
      return await fn();
    } catch (e) {
      if (!String(e).includes("429")) throw e;
      await wait(40_000 * (i + 1));
    }
  }
  throw new Error("rate limited");
}

async function main() {
  const spreadsheetId = process.env.VALYTICA_CRM_SHEET_ID;
  if (!spreadsheetId) throw new Error("VALYTICA_CRM_SHEET_ID is not set");

  const tabs = await retry(() => listTabs(spreadsheetId));
  const meta = tabs.find((t) => t.title === TAB);
  if (!meta) throw new Error("People tab not found.");

  const grid = await retry(() => readRange(spreadsheetId, `'${TAB}'!A1:BZ6000`));
  const headers = (grid[0] ?? []).map((h) => cell(h).trim());

  const present = DROP.filter((d) => headers.includes(d));
  const absent = DROP.filter((d) => !headers.includes(d));
  absent.forEach((d) => console.log(`${d} — already gone`));
  if (!present.length) {
    console.log("Nothing to drop.");
    return;
  }

  console.log(`People: ${headers.filter(Boolean).length} columns\n`);
  console.log("dropping:");
  const indexes = present.map((d) => {
    const i = headers.indexOf(d);
    const filled = grid.slice(1).filter((r) => cell(r[i]).trim() !== "").length;
    console.log(`  ${colLetter(i).padEnd(3)} ${d.padEnd(22)} ${filled} non-empty cell(s)`);
    return i;
  });

  const after = headers.filter(Boolean).filter((h) => !present.includes(h as (typeof DROP)[number]));
  console.log(`\n${headers.filter(Boolean).length} columns → ${after.length}`);
  console.log("\nsurvivors move to:");
  for (const name of MUST_SURVIVE) {
    const was = headers.indexOf(name);
    const now = after.indexOf(name);
    if (was < 0) {
      console.log(`  ${name.padEnd(20)} NOT PRESENT — refusing`);
      throw new Error(`${name} is missing from People; refusing to delete anything.`);
    }
    console.log(`  ${name.padEnd(20)} ${colLetter(was)} → ${colLetter(now)}`);
  }

  if (!APPLY) {
    console.log("\nDry run. Nothing written. Re-run with --apply.");
    return;
  }

  // The values are a machine's working-out, but they are keyed to real people;
  // keep a copy out of the repo before discarding them.
  mkdirSync("tmp", { recursive: true });
  const pidCol = headers.indexOf("person_id");
  const snap = `tmp/people-dropped-columns-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(
    snap,
    JSON.stringify(
      grid
        .slice(1)
        .filter((r) => cell(r[pidCol]).trim())
        .map((r) => Object.fromEntries([["person_id", cell(r[pidCol])], ...present.map((d) => [d, cell(r[headers.indexOf(d)])])])),
      null,
      2,
    ),
  );
  console.log(`\nsnapshot: ${snap}`);

  // Descending, or each delete shifts the ones after it.
  const token = await getAccessToken();
  const requests = [...indexes]
    .sort((a, b) => b - a)
    .map((i) => ({ deleteDimension: { range: { sheetId: meta.sheetId, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 } } }));
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) throw new Error(`deleteDimension → ${res.status}: ${(await res.text()).slice(0, 400)}`);
  console.log(`deleted ${requests.length} column(s)`);

  const check = ((await retry(() => readRange(spreadsheetId, `'${TAB}'!A1:BZ1`)))[0] ?? []).map((h) => cell(h).trim());
  const live = check.filter(Boolean);
  console.log(`\nverification — People now has ${live.length} columns`);
  for (const d of present) {
    console.log(`  ${d.padEnd(22)} ${live.includes(d) ? "*** STILL PRESENT ***" : "gone"}`);
    if (live.includes(d)) process.exitCode = 1;
  }
  for (const name of MUST_SURVIVE) {
    const at = live.indexOf(name);
    console.log(`  ${name.padEnd(22)} ${at >= 0 ? `at ${colLetter(at)}` : "*** LOST ***"}`);
    if (at < 0) process.exitCode = 1;
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
