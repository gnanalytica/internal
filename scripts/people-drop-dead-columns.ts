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
/** `--tab=Companies` to clean the other master; People by default. */
const TAB = (process.argv.find((a) => a.startsWith("--tab="))?.split("=")[1] ?? "People").trim();

/**
 * Default set: the dedupe scratch columns retired on 2026-09-26. Override with
 * `--columns=a,b,c` for a different set — the 2026-09-27 round drops
 * `ibbi_asset_class` (3,183 rows, ONE distinct value — "Land and Building" —
 * so it cannot distinguish anybody), `whatsapp_available` (189 of its 203
 * values are literally "Unknown") and `firm_name` (run
 * `pnpm sheet:retire-firm-name` FIRST), and on Companies `duplicate_flag`
 * (350 rows, all "UNIQUE", so it flags nothing and structurally cannot).
 */
const DEFAULT_DROP = ["canonical_entity_key", "normalized_name_key", "match_rule", "duplicate_match_ids"];
const DROP = (process.argv.find((a) => a.startsWith("--columns="))?.split("=")[1]?.split(",").map((s) => s.trim()).filter(Boolean) ??
  DEFAULT_DROP) as readonly string[];
/**
 * Checked by name after the deletion — these must survive. `duplicate_flag` is
 * on both lists: People's drives `crmContacts.sheetDuplicate`, and Companies'
 * drives nothing but is a duplicate signal a person reads while working in the
 * sheet, so it stays on both for consistency.
 */
const MUST_SURVIVE_BY_TAB: Record<string, readonly string[]> = {
  People: ["person_id", "full_name", "duplicate_flag", "owner", "is_institutional", "persona"],
  Companies: ["company_id", "company_name", "linked_person_ids", "duplicate_flag", "owner"],
};
// A column cannot be both dropped and asserted to survive: Companies'
// duplicate_flag was a survivor in the previous round and is a target in this
// one, and a stale list here would abort a legitimate deletion.
const MUST_SURVIVE = (MUST_SURVIVE_BY_TAB[TAB] ?? []).filter((h) => !DROP.includes(h));

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
  if (!meta) throw new Error(`Tab "${TAB}" not found.`);

  if (!MUST_SURVIVE.length) throw new Error(`No survivor list defined for "${TAB}". Refusing.`);
  const grid = await retry(() => readRange(spreadsheetId, `'${TAB}'!A1:BZ6000`));
  const headers = (grid[0] ?? []).map((h) => cell(h).trim());

  const present = DROP.filter((d) => headers.includes(d));
  const absent = DROP.filter((d) => !headers.includes(d));
  absent.forEach((d) => console.log(`${d} — already gone`));
  if (!present.length) {
    console.log("Nothing to drop.");
    return;
  }

  console.log(`${TAB}: ${headers.filter(Boolean).length} columns\n`);
  console.log("dropping:");
  const indexes = present.map((d) => {
    const i = headers.indexOf(d);
    const filled = grid.slice(1).filter((r) => cell(r[i]).trim() !== "").length;
    console.log(`  ${colLetter(i).padEnd(3)} ${d.padEnd(22)} ${filled} non-empty cell(s)`);
    return i;
  });

  const after = headers.filter(Boolean).filter((h) => !present.includes(h));
  console.log(`\n${headers.filter(Boolean).length} columns → ${after.length}`);
  console.log("\nsurvivors move to:");
  for (const name of MUST_SURVIVE) {
    const was = headers.indexOf(name);
    const now = after.indexOf(name);
    if (was < 0) {
      console.log(`  ${name.padEnd(20)} NOT PRESENT — refusing`);
      throw new Error(`${name} is missing from ${TAB}; refusing to delete anything.`);
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
  const idHeader = MUST_SURVIVE[0];
  const pidCol = headers.indexOf(idHeader);
  const snap = `tmp/people-dropped-columns-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(
    snap,
    JSON.stringify(
      grid
        .slice(1)
        .filter((r) => cell(r[pidCol]).trim())
        .map((r) => Object.fromEntries([[idHeader, cell(r[pidCol])], ...present.map((d) => [d, cell(r[headers.indexOf(d)])])])),
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
  console.log(`\nverification — ${TAB} now has ${live.length} columns`);
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
