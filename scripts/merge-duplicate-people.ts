import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "node:fs";

import { a1 } from "../src/lib/sheet-crm/mapping";
import { getAccessToken } from "../src/lib/sheet-crm/google-auth";
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
const APPLY = process.argv.includes("--apply");

/** keeper (has the IBBI registration) ← panel row folded into it and deleted. */
const PAIRS: [keep: string, drop: string][] = [
  ["P00038", "P02342"], // Chittari Ramachandrudu ← C RAMA CHANDRUDU
  ["P00167", "P05595"], // Ramesh Kumar Malyala ← M.Ramesh Kumar
  ["P00355", "P05558"], // Govinda Rao Gopal ← G Gopal
  ["P00536", "P05556"], // Rajashekhar Nandeppa Topagi ← Rajashekhar N Topagi
  ["P01123", "P01041"], // Athikarappan Arivazhagan ← A ARIVAZHAGAN (both Madurai)
  ["P01230", "P02565"], // Duraimuthu ← P. DURAI MUTHU
  ["P01674", "P01071"], // Rakkappan Anbazhagan ← ANBAZHAGAN A
  ["P02154", "P05588"], // N Baburao ← Nallapu Babu rao (N = Nallapu)
  ["P02180", "P05594"], // Peddi Satya Narayana Reddy ← P. Satya Narayana Reddy
  ["P03195", "P05545"], // Abhishek Kirankumar Shah ← Abhishek K Shah
  ["P03277", "P05540"], // Drugesh Kiritbhai Shah ← Durgesh Kirit Shah
  ["P03300", "P05530"], // Harish Champaklal Bhavsar ← Harish C. Bhavsar
  ["P03393", "P05555"], // Mehta Nimish ← Nimish Rumendra Mehta
  ["P03404", "P05528"], // Mital Pravinchandra Sanghvi ← Mital Sanghvi
  ["P03427", "P05548"], // Nihirbabu Dave ← Nihirbabu Balvantray Dave
  ["P03505", "P05529"], // Priyank Nayak ← Priyank Nitin Kumar Nayak
  ["P03534", "P05550"], // Raval Nimeshkumar Manuprasad ← Mr. Nimesh Manuprasad Raval
  ["P03590", "P05532"], // Shvetangkumar Narsinhbhai Patel ← Shvetang N. Patel
  ["P03597", "P02735"], // Suresh Dewandas Harwani ← SURESH D HARWANI
  ["P03605", "P05533"], // Thakkar Mukeshkumar ← Mukeshkumar Bansilal Thakkar
  ["P03624", "P05534"], // Vikrambhai Rajnikantbhai Bhatt ← Vikram Rajnikant Bhatt
  ["P04432", "P05615"], // Ram Dunichand Tarachandani ← Ram D Tarachandani
  ["P04570", "P05625"], // Suresh Baliram Piplewar ← Suresh Piplewar
  ["P04726", "P05568"], // Bharat Bhushan Goyal ← Bharat Bhushan
];

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

/** Same email, genuinely ambiguous — a person decides these, not this script. */
const UNCERTAIN = [
  ["P01705", "P01622"], // Rasappan Ramasamy (Salem) / R RAMASAMY (Chennai)
  ["P01155", "P01523"], // Balasundaram … Thanaraj (Thanjavur) / N T BALASUNDARAM (Madurai)
  ["P03709", "P05585"], // Parveen Kumar Gupta / Praveen Kumar
  ["P04569", "P05626"], // Surendra Bhaurao Gordey / SB Girdey
];

/** Semicolon lists: the union, not the keeper's copy. Losing a source or a bank panel is the point of not deleting blindly. */
const LIST_COLUMNS = new Set(["sources", "empanelled_with", "enrichment_sources", "other_asset_classes", "company_names", "associations_and_roles"]);
/** Identity of the surviving row — never taken from the row being deleted. */
const NEVER_FOLD = new Set(["person_id", "full_name", "ibbi_reg_no", "ibbi_asset_class", "ibbi_reg_date", "data_quality_flag"]);

const cell = (v: unknown) => String(v ?? "").trim();
const parts = (v: string) => v.split(";").map((s) => s.trim()).filter(Boolean);

function unionList(keep: string, drop: string): string | null {
  const have = parts(keep);
  const seen = new Set(have.map((s) => s.toLowerCase()));
  const added = parts(drop).filter((s) => !seen.has(s.toLowerCase()));
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

  for (const [keepPid, dropPid] of PAIRS) {
    const kr = rowOf.get(keepPid);
    const dr = rowOf.get(dropPid);
    if (kr === undefined || dr === undefined) {
      missing.push(`${keepPid}←${dropPid}`);
      continue;
    }
    const krow = values[kr] ?? [];
    const drow = values[dr] ?? [];
    const snap: Record<string, unknown> = { _deleted_row_number: dr + 1, _folded_into: keepPid };
    const changed: string[] = [];

    headers.forEach((h, c) => {
      const name = h.trim();
      if (name) snap[name] = cell(drow[c]);
      if (!name || NEVER_FOLD.has(name) || people.formulaCols.has(c)) return;
      const kv = cell(krow[c]);
      const dv = cell(drow[c]);
      if (!dv) return;
      const next = LIST_COLUMNS.has(name) ? (kv ? unionList(kv, dv) : dv) : kv ? null : dv;
      if (next === null || next === kv) return;
      writes.push({ range: a1(people.title, kr, c), value: next });
      changed.push(name);
    });

    snapshot.push(snap);
    deleteAt.push(dr);
    if (changed.length) folded++;
    console.log(`  ${keepPid} ← ${dropPid} (row ${dr + 1})${changed.length ? `: ${changed.join(", ")}` : ": nothing to carry"}`);
  }

  console.log(
    `\n${APPLY ? "→" : "would"} fold ${folded}/${PAIRS.length} pairs (${writes.length} cells) and delete ${deleteAt.length} rows` +
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
