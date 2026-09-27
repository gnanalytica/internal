/**
 * Merge the duplicate Lenders rows.
 *
 * 36 of 129 rows are the same institution twice, because two research passes
 * wrote the same bank under two spellings — "CSB Bank" and "CSB Bank Ltd
 * (formerly Catholic Syrian Bank)". The migration's own matcher only found 8 of
 * them: it stripped "valuers" and "foundation" but not "Bank", which is exactly
 * the word these pairs differ on.
 *
 * The pairs are COMPLEMENTARY, not redundant. One row of each pair carries
 * priority and notes, the other carries empanelment_window — so picking a
 * survivor loses real research either way, and the merge has to be a field-by-
 * field union. Where both sides state a value and they disagree, the survivor's
 * is kept and the other is recorded in notes rather than discarded.
 *
 * Survivor is the LOWEST id, so ids only ever disappear upward and the two
 * inbound links that exist can be repointed mechanically. The NAME taken is the
 * longest, because "CSB Bank Ltd (formerly Catholic Syrian Bank)" is what lets a
 * valuer's panel list match later.
 *
 * `pnpm sheet:merge-lender-dupes` to see the plan, `--apply` to write it.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { getAccessToken } from "../src/lib/sheet-crm/google-auth";
import { readRange } from "../src/lib/sheet-crm/sheets-api";
import { GTM_TABS } from "../src/lib/sheet-crm/gtm-model";

const APPLY = process.argv.includes("--apply");
const c = (v: unknown) => (v ?? "").toString().trim();
const SPEC = GTM_TABS.find((t) => t.title === "Lenders")!;

/** Keeps "Bank" out of the comparison; that is the word the pairs differ on. */
const key = (s: string) =>
  s.toLowerCase().replace(/\(.*?\)/g, " ")
    .replace(/\b(the|ltd|limited|pvt|private|company|co|corporation)\b/g, " ")
    .replace(/[^a-z0-9]/g, "");

/** Looser still. Reported only — "India" can distinguish two real institutions. */
const keyLoose = (s: string) => key(s).replace(/\b/g, "").replace(/bank|india|indian/g, "");

async function main() {
  const spreadsheetId = process.env.VALYTICA_CRM_SHEET_ID;
  if (!spreadsheetId) throw new Error("VALYTICA_CRM_SHEET_ID is not set");

  const rows = await readRange(spreadsheetId, "'Lenders'!A1:BZ200");
  const header = (rows[0] ?? []).map(c).filter(Boolean);
  if (header.join("|") !== SPEC.columns.join("|")) throw new Error("Lenders header does not match the schema.");
  const ci = (k: string) => SPEC.columns.indexOf(k);

  // sheetRow is the 1-based row on the tab, needed for the delete.
  const live = rows.slice(1).map((r, i) => ({ r, sheetRow: i + 2 })).filter((x) => c(x.r[0]));

  const groups = new Map<string, typeof live>();
  live.forEach((x) => {
    const k = key(c(x.r[ci("lender_name")]));
    groups.set(k, [...(groups.get(k) ?? []), x]);
  });
  const dupes = [...groups.values()].filter((g) => g.length > 1)
    .map((g) => [...g].sort((a, b) => c(a.r[0]).localeCompare(c(b.r[0]))));

  // Count what the looser matcher would add, without acting on it.
  const looseGroups = new Map<string, string[]>();
  live.forEach((x) => {
    const k = keyLoose(c(x.r[ci("lender_name")]));
    looseGroups.set(k, [...(looseGroups.get(k) ?? []), c(x.r[0])]);
  });
  const extra = [...looseGroups.values()].filter((g) => g.length > 1).length - dupes.length;

  // Who points at a lender id today.
  const inbound = new Map<string, string[]>();
  for (const [tab, col, n] of [["Valuers", "empanelled_lenders", 5100], ["Firms", "empanelled_lenders", 400]] as const) {
    const t = await readRange(spreadsheetId, `'${tab}'!A1:BZ${n}`);
    const h = (t[0] ?? []).map(c);
    const i = h.indexOf(col);
    t.slice(1).forEach((r) => {
      const who = c(r[0]);
      c(r[i]).split(/;\s*/).filter(Boolean).forEach((x) => inbound.set(x, [...(inbound.get(x) ?? []), who]));
    });
  }

  let gained = 0, conflicts = 0, repoints = 0;
  const plan = dupes.map((g) => {
    const survivor = g[0];
    const losers = g.slice(1);
    const bestName = [survivor, ...losers].map((x) => c(x.r[ci("lender_name")])).sort((a, b) => b.length - a.length)[0];
    const merged = SPEC.columns.map((_, i) => c(survivor.r[i]));
    const takes: string[] = [];
    const clashes: string[] = [];
    const extraNotes: string[] = [];

    merged[ci("lender_name")] = bestName;
    for (const l of losers) {
      SPEC.columns.forEach((col, i) => {
        if (col === "lender_id" || col === "lender_name") return;
        const mine = merged[i], theirs = c(l.r[i]);
        if (!theirs) return;
        if (!mine) { merged[i] = theirs; takes.push(`${col} <- ${c(l.r[0])}`); gained++; return; }
        if (mine !== theirs) {
          clashes.push(`${col}`);
          extraNotes.push(`${c(l.r[0])} said ${col}="${theirs.slice(0, 60)}"`);
          conflicts++;
        }
      });
      const ptr = inbound.get(c(l.r[0])) ?? [];
      repoints += ptr.length;
    }
    if (extraNotes.length) {
      merged[ci("notes")] = [merged[ci("notes")], `Merged from ${losers.map((l) => c(l.r[0])).join(", ")}. ${extraNotes.join("; ")}`].filter(Boolean).join(" | ");
    }
    return { survivor, losers, merged, takes, clashes, bestName };
  });

  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${dupes.length} groups, ${dupes.reduce((a, g) => a + g.length, 0)} of ${live.length} rows\n`);
  for (const p of plan) {
    console.log(`── ${p.bestName}`);
    console.log(`   keep   ${c(p.survivor.r[0])}`);
    for (const l of p.losers) {
      const ptr = inbound.get(c(l.r[0])) ?? [];
      console.log(`   drop   ${c(l.r[0])}  "${c(l.r[ci("lender_name")]).slice(0, 52)}"${ptr.length ? `  repoint ${ptr.length} link(s) from ${ptr.slice(0, 3).join(", ")}` : ""}`);
    }
    if (p.takes.length) console.log(`   gains  ${p.takes.join(", ")}`);
    if (p.clashes.length) console.log(`   clash  ${p.clashes.join(", ")}  -> survivor's value kept, other recorded in notes`);
    console.log("");
  }
  console.log(`totals: ${gained} field(s) gained, ${conflicts} clash(es) recorded, ${repoints} link(s) to repoint`);
  console.log(`Lenders ${live.length} -> ${live.length - dupes.reduce((a, g) => a + g.length - 1, 0)}`);
  if (extra > 0) console.log(`\nNOT acted on: a looser matcher that also ignores "Bank"/"India" finds ${extra} more group(s). Reported only — those two words can distinguish two real institutions.`);

  if (!APPLY) { console.log("\nRe-run with --apply."); return; }

  const token = await getAccessToken();
  const api = async (body: unknown, path = ":batchUpdate") => {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${path} ${res.status}: ${(await res.text()).slice(0, 400)}`);
    return res.json();
  };
  const letter = (x: number) => { let str = "", i = x; while (i >= 0) { str = String.fromCharCode(65 + (i % 26)) + str; i = Math.floor(i / 26) - 1; } return str; };

  // 1. Repoint every inbound link off a loser and onto its survivor, BEFORE the
  //    delete — a link pointing at a row that no longer exists is unrecoverable
  //    without re-deriving the whole mapping.
  const redirect = new Map<string, string>();
  plan.forEach((p) => p.losers.forEach((l) => redirect.set(c(l.r[0]), c(p.survivor.r[0]))));
  for (const [tab, col, n] of [["Valuers", "empanelled_lenders", 5100], ["Firms", "empanelled_lenders", 400]] as const) {
    const t = await readRange(spreadsheetId, `'${tab}'!A1:BZ${n}`);
    const h = (t[0] ?? []).map(c);
    const i = h.indexOf(col);
    const edits: { range: string; values: string[][] }[] = [];
    t.slice(1).forEach((r, idx) => {
      const ids = c(r[i]).split(/;\s*/).filter(Boolean);
      if (!ids.some((x) => redirect.has(x))) return;
      const next = [...new Set(ids.map((x) => redirect.get(x) ?? x))].join("; ");
      edits.push({ range: `'${tab}'!${letter(i)}${idx + 2}`, values: [[next]] });
    });
    if (edits.length) {
      await api({ valueInputOption: "RAW", data: edits }, "/values:batchUpdate");
      console.log(`repointed ${edits.length} row(s) in ${tab}`);
    }
  }

  // 2. Write each merged survivor in place.
  await api({
    valueInputOption: "RAW",
    data: plan.map((p) => ({ range: `'Lenders'!A${p.survivor.sheetRow}:${letter(SPEC.columns.length - 1)}${p.survivor.sheetRow}`, values: [p.merged] })),
  }, "/values:batchUpdate");
  console.log(`merged ${plan.length} survivor row(s)`);

  // 3. Delete the losers, bottom-up: deleting a row shifts every row beneath it,
  //    so ascending order would delete the wrong rows after the first.
  const meta = await (await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)`, { headers: { Authorization: `Bearer ${token}` } })).json();
  const sheetId = meta.sheets.find((x: { properties: { title: string } }) => x.properties.title === "Lenders")?.properties.sheetId;
  if (sheetId === undefined) throw new Error("no sheetId for Lenders");
  const doomed = plan.flatMap((p) => p.losers.map((l) => l.sheetRow)).sort((a, b) => b - a);
  await api({
    requests: doomed.map((row) => ({ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: row - 1, endIndex: row } } })),
  });
  console.log(`deleted ${doomed.length} duplicate row(s)`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
