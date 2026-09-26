import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "node:fs";

import { a1 } from "../src/lib/sheet-crm/mapping";
import { getAccessToken } from "../src/lib/sheet-crm/google-auth";
import { repointMergedContacts } from "../src/lib/sheet-crm/merge-projection";
import { listTabs, readTabs, writeCells } from "../src/lib/sheet-crm/sheets-api";
import { discoverLayouts } from "../src/lib/sheet-crm/sync";

/**
 * Merge the reviewed duplicate People rows: fold the panel row up into the
 * IBBI row, then delete the panel row.
 *
 * The pairs below were reviewed BY NAME, one at a time, and are hard-coded
 * rather than re-derived at apply time. Shared-email is the only signal that
 * finds these (IBBI numbers are unique across the tab, and only 334 rows carry
 * a phone at all), but it is not sufficient on its own: six pairs sharing an
 * address turned out to be different people, four of them colleagues at one
 * firm using an office address. A rule that deleted on email alone would have
 * destroyed them.
 *
 * `pnpm sheet:merge-dupes` prints the plan; `--apply` runs it.
 */
import { MERGED_PAIRS as PAIRS } from "./merged-pairs";

const APPLY = process.argv.includes("--apply");


/**
 * Same email, different people — left alone deliberately. The first four share
 * one firm's office address; re-deriving the pair list from email would pick
 * them back up, which is why PAIRS is a literal.
 */
const REJECTED = [
  ["P04312", "P05628"], // Mahendraa Sharadchandra Patil / Archana H. Salapurkar
  ["P04318", "P05629"], // Makarand Gopalrao Rajendra / Ashish Shyamkishore Nashine
  ["P04548", "P05631"], // Somnath Laxman Phadatare / Atul Ambadas Thombare
  ["P04284", "P05630"], // Laddha Deven Deelip / Suvrat S.Bhobe
  ["P02083", "P03056"], // Gauri Shankar Mittal (Hyderabad) / M/S H P MITTAL (Delhi)
  ["P03725", "P00881"], // Rajeev Juneja / RAJEEV KUMAR T K (Ernakulam)
];

/**
 * Same email, genuinely ambiguous — a person decides these, not this script.
 * Empty since 2026-09-21: all four were read through and moved into PAIRS. A
 * pair belongs here whenever the names alone do not settle it, because
 * deciding one costs a few minutes of reading and deleting the wrong row costs
 * a prospect.
 */
const UNCERTAIN: [string, string][] = [];

/**
 * Semicolon lists: the union, not the keeper's copy. Losing a source or a bank
 * panel is the point of not deleting blindly — and `city` is here because a
 * valuer is routinely empanelled across several, so the two rows disagreeing
 * about it is information rather than a conflict to resolve by picking one.
 * Every consumer filters city with `ilike '%…%'`, so a list still matches.
 */
const LIST_COLUMNS = new Set(["sources", "empanelled_with", "enrichment_sources", "other_asset_classes", "company_names", "associations_and_roles", "city"]);
/**
 * A value only folds if it fits the column it is going into.
 *
 * The rows a research pass has touched are sometimes shifted by a column, so a
 * full address turns up in `city`, prose in `website`, and source provenance in
 * `source_count`. Folding by "the survivor is empty, so take theirs" then
 * copies that misalignment onto the row that is being kept — permanently, since
 * the row it came from is deleted in the same run. ~58 cells across the tab are
 * off-type today (2026-09-26 audit), so this is narrow, but it lands precisely
 * on the rows a duplicate pass is looking at.
 *
 * A refusal is logged, never silent: the value is real research and a human may
 * want to place it by hand.
 */
const SHAPE: Record<string, (v: string) => boolean> = {
  num_empanelments: (v) => /^\d+$/.test(v),
  source_count: (v) => /^\d+$/.test(v),
  lead_score: (v) => /^\d+$/.test(v),
  pincode: (v) => /^\d{6}$/.test(v),
  website: (v) => /^(https?:\/\/|www\.)/i.test(v) || (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(v) && !v.includes(" ")),
  research_confidence: (v) => /^(high|medium|low|unknown)$/i.test(v),
  whatsapp_available: (v) => /^(yes|no|unknown)$/i.test(v),
  is_south_india: (v) => /^(yes|no|unknown)$/i.test(v),
  // A city is a place name. The address belongs in `address`; a comma or any
  // real length means this is one.
  city: (v) => v.length < 40 && !v.includes(","),
  state: (v) => v.length < 30,
  // Short bank codes: `pnb_category` is one letter across 853 rows,
  // `pnb_constitution` an Individual/Proprietorship token. `firm_size` and
  // `specialisation` are deliberately NOT here — a researcher writes real prose
  // in those two, so a length gate would refuse legitimate values.
  pnb_category: (v) => v.length <= 12,
  pnb_constitution: (v) => v.length <= 30,
};

/** Identity of the surviving row — never taken from the row being deleted. */
const NEVER_FOLD = new Set(["person_id", "full_name", "ibbi_reg_no", "ibbi_asset_class", "ibbi_reg_date", "data_quality_flag"]);

const cell = (v: unknown) => String(v ?? "").trim();
const parts = (v: string) => v.split(";").map((s) => s.trim()).filter(Boolean);

/**
 * Two spellings of one city are not two cities. Only genuine aliases belong
 * here: Tumkur and Bengaluru are different places and both must survive, which
 * is the whole reason `city` is a list column.
 */
const SAME_PLACE: Record<string, string> = { bengaluru: "bangalore" };
const canon = (s: string) => SAME_PLACE[s.toLowerCase()] ?? s.toLowerCase();

function unionList(keep: string, drop: string): string | null {
  const have = parts(keep);
  const seen = new Set(have.map(canon));
  const added = parts(drop).filter((s) => !seen.has(canon(s)));
  return added.length ? [...have, ...added].join("; ") : null;
}

async function deleteRows(spreadsheetId: string, sheetId: number, rowIndexes0: number[]) {
  const token = await getAccessToken();
  // Descending, or each delete shifts the ones after it.
  const requests = [...rowIndexes0].sort((a, b) => b - a).map((r) => ({
    deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: r, endIndex: r + 1 } },
  }));
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) throw new Error(`deleteDimension → ${res.status}: ${(await res.text()).slice(0, 400)}`);
}

async function main() {
  const id = process.env.VALYTICA_CRM_SHEET_ID;
  if (!id) throw new Error("VALYTICA_CRM_SHEET_ID is not set.");
  const { layouts } = await discoverLayouts(id);
  const people = layouts.get("people");
  if (!people) throw new Error("People tab not found by its header signature.");
  const meta = (await listTabs(id)).find((t) => t.title === people.title)!;

  const values = (await readTabs(id, [people.title])).get(people.title) ?? [];
  const headers = people.headers.map((h) => String(h ?? ""));
  const pidCol = headers.indexOf("person_id");
  if (pidCol < 0) throw new Error("People has no person_id column.");

  const rowOf = new Map<string, number>();
  for (let r = people.headerRow0 + 1; r < values.length; r++) {
    const k = cell(values[r]?.[pidCol]);
    if (k && !rowOf.has(k)) rowOf.set(k, r);
  }

  const writes: { range: string; value: string }[] = [];
  const snapshot: Record<string, unknown>[] = [];
  const deleteAt: number[] = [];
  const missing: string[] = [];
  let folded = 0;
  let already = 0;

  for (const [keepPid, dropPid] of PAIRS) {
    const kr = rowOf.get(keepPid);
    const dr = rowOf.get(dropPid);
    // Merged on an earlier run — the panel row is gone and the keeper is not.
    // That is the finished state, not a missing row, and re-running must say so.
    if (dr === undefined && kr !== undefined) {
      already++;
      continue;
    }
    if (kr === undefined || dr === undefined) {
      missing.push(`${keepPid}←${dropPid}`);
      continue;
    }
    const krow = values[kr] ?? [];
    const drow = values[dr] ?? [];
    const snap: Record<string, unknown> = { _deleted_row_number: dr + 1, _folded_into: keepPid };
    const changed: string[] = [];
    const refused: string[] = [];

    // A bank-panel row's `city` is routinely the bank's ZONE rather than where
    // the person is — 222 rows carry a city their own address contradicts. The
    // tell is city === pnb_zone. Folding that onto the survivor would move a
    // valuer in Tanuku to Hyderabad, so the column is dropped for this row.
    const zoneCity =
      cell(drow[headers.indexOf("city")]) !== "" &&
      cell(drow[headers.indexOf("city")]).toLowerCase() === cell(drow[headers.indexOf("pnb_zone")]).toLowerCase();

    headers.forEach((h, c) => {
      const name = h.trim();
      if (name) snap[name] = cell(drow[c]);
      if (!name || NEVER_FOLD.has(name) || people.formulaCols.has(c)) return;
      if (name === "city" && zoneCity) return;
      const kv = cell(krow[c]);
      const dv = cell(drow[c]);
      if (!dv) return;
      if (SHAPE[name] && !SHAPE[name](dv)) {
        refused.push(`${name}=${JSON.stringify(dv.slice(0, 60))}`);
        return;
      }
      const next = LIST_COLUMNS.has(name) ? (kv ? unionList(kv, dv) : dv) : kv ? null : dv;
      if (next === null || next === kv) return;
      writes.push({ range: a1(people.title, kr, c), value: next });
      changed.push(name);
    });

    snapshot.push(snap);
    deleteAt.push(dr);
    if (changed.length) folded++;
    console.log(`  ${keepPid} ← ${dropPid} (row ${dr + 1})${changed.length ? `: ${changed.join(", ")}` : ": nothing to carry"}`);
    for (const r of refused) console.log(`     not folded (wrong shape for its column): ${r}`);
  }

  console.log(
    `\n${APPLY ? "→" : "would"} fold ${folded} pair(s) (${writes.length} cells) and delete ${deleteAt.length} rows` +
      (already ? `\n   ${already} of ${PAIRS.length} already merged on an earlier run` : "") +
      `\n   left alone: ${REJECTED.length} different-people pairs, ${UNCERTAIN.length} uncertain`,
  );
  if (missing.length) console.log(`   ✗ not found in the sheet: ${missing.join(", ")}`);
  // A membership row keyed to a person_id that is about to disappear is an
  // orphan; move it to the surviving twin before the row goes.
  const repoint: { range: string; value: string }[] = [];
  const iov = layouts.get("iov_memberships");
  if (iov) {
    const keeperOf = new Map(PAIRS.map(([k, d]) => [d, k]));
    const iovValues = (await readTabs(id, [iov.title])).get(iov.title) ?? [];
    const iovHeaders = iov.headers.map((h) => String(h ?? ""));
    const c = iovHeaders.indexOf("person_id");
    if (c < 0) throw new Error("iov_memberships has no person_id column.");
    if (iov.formulaCols.has(c)) throw new Error("iov_memberships.person_id carries a formula — refusing to rewrite it.");
    for (let r = iov.headerRow0 + 1; r < iovValues.length; r++) {
      const keeper = keeperOf.get(cell(iovValues[r]?.[c]));
      if (keeper) repoint.push({ range: a1(iov.title, r, c), value: keeper });
    }
  }
  console.log(`   ${repoint.length} iov_memberships row(s) re-pointed to the surviving person`);

  if (!APPLY) return;


  mkdirSync("tmp", { recursive: true });
  const path = `tmp/deleted-people-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(path, JSON.stringify({ deletedAt: new Date().toISOString(), rows: snapshot }, null, 2));
  console.log(`   ✓ snapshot of ${snapshot.length} rows → ${path}`);

  // Fold BEFORE deleting: a half-finished run must never have dropped a row
  // whose phone number had not yet reached its twin.
  const all = [...writes, ...repoint];
  for (let i = 0; i < all.length; i += 200) await writeCells(id, all.slice(i, i + 200), "RAW");
  console.log(`   ✓ ${all.length} cells written (${writes.length} folded, ${repoint.length} re-pointed)`);

  // Before the rows go: the sync deletes each loser's projected contact once
  // its sheet row disappears, and interactions/activities cascade with it.
  // Move that history onto the survivor first — see merge-projection.ts.
  const moved = await repointMergedContacts(PAIRS.map(([keep, drop]) => ({ keep, drop })));
  console.log(
    `   ✓ mirror: ${moved.interactions} interaction(s), ${moved.activities} activity(ies) re-pointed` +
      `, ${moved.ownersCarried} owner(s) carried to the survivor`,
  );

  await deleteRows(id, meta.sheetId, deleteAt);
  console.log(`   ✓ ${deleteAt.length} rows deleted`);

  const after = (await readTabs(id, [people.title])).get(people.title) ?? [];
  const live = new Set<string>();
  for (let r = people.headerRow0 + 1; r < after.length; r++) live.add(cell(after[r]?.[pidCol]));
  const stillThere = PAIRS.filter(([, d]) => live.has(d)).map(([, d]) => d);
  const lostKeepers = PAIRS.filter(([k]) => !live.has(k)).map(([k]) => k);
  console.log(`   ✓ verified: ${PAIRS.length - stillThere.length}/${PAIRS.length} panel rows gone, ${PAIRS.length - lostKeepers.length}/${PAIRS.length} keepers intact`);
  if (stillThere.length) console.log(`   ✗ still present: ${stillThere.join(", ")}`);
  if (lostKeepers.length) console.log(`   ✗ KEEPER MISSING: ${lostKeepers.join(", ")}`);
  console.log(`   rows now: ${after.length - people.headerRow0 - 1}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
