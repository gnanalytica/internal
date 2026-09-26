/**
 * Fold Prospect Intelligence, Deep Dive Dossiers and Research Queue into People.
 *
 * Those three tabs describe 26 of the sheet's 5,611 people, and 25 of the 26
 * appear in more than one of them. They are not merely duplication, though:
 * `projectPerson` reads eight app fields ONLY from them — priority,
 * opportunity_score, score_band, research_status, best_first_channel, persona,
 * and phone/email/city/state/ibbi_reg_no as fallbacks. So they cannot be
 * retired until People carries those columns itself.
 *
 * This is step 1-2 of that: add the columns, backfill the 26, touch nothing
 * else. The tabs stay exactly as they are. Only once `projectPerson` reads
 * People alone and produces an identical projection is anything retired.
 *
 * The fallback fills mirror `projectPerson`'s own `??` chain precisely — People
 * first, Prospect Intelligence only where People is blank — because that is
 * what makes dropping the chain lossless rather than a guess.
 *
 * `pnpm sheet:fold-gtm`; `--apply` writes.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "node:fs";

import { getAccessToken } from "../src/lib/sheet-crm/google-auth";
import { listTabs, readRange, readTabs, writeCells } from "../src/lib/sheet-crm/sheets-api";

const APPLY = process.argv.includes("--apply");
const TAB = "People";

/** New columns, appended after the last existing one so nothing shifts. */
const NEW_COLUMNS = [
  "research_status",
  "priority",
  "opportunity_score",
  "score_band",
  "persona",
  "best_first_channel",
  "next_action",
  "why_now",
  "pain",
  "is_institutional",
] as const;

/** Existing People columns that may be filled from Prospect Intelligence when blank. */
const FALLBACKS: { people: string; from: string }[] = [
  { people: "phone", from: "Public Phone" },
  { people: "email", from: "Public Email" },
  { people: "city", from: "City" },
  { people: "state", from: "State" },
  { people: "ibbi_reg_no", from: "IBBI Reg No" },
];

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

const cell = (v: unknown) => (v ?? "").toString().trim();

function colLetter(index0: number): string {
  let n = index0,
    s = "";
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

/** These tabs carry a title banner above the real header row. */
function headerRowOf(all: unknown[][]): number {
  let hi = 0,
    best = 0;
  all.slice(0, 8).forEach((r, i) => {
    const n = r.filter((c) => {
      const v = cell(c);
      return v && v.length < 40;
    }).length;
    if (n > best) {
      best = n;
      hi = i;
    }
  });
  return hi;
}

function indexTab(all: unknown[][], idHeaderPattern: RegExp) {
  const hi = headerRowOf(all);
  const headers = (all[hi] ?? []).map(cell);
  const idCol = headers.findIndex((h) => idHeaderPattern.test(h));
  const byId = new Map<string, Record<string, string>>();
  if (idCol < 0) return { headers, byId };
  for (const row of all.slice(hi + 1)) {
    const id = cell(row[idCol]);
    if (!id) continue;
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (h) rec[h] = cell(row[i]);
    });
    byId.set(id, rec);
  }
  return { headers, byId };
}

async function main() {
  const spreadsheetId = process.env.VALYTICA_CRM_SHEET_ID;
  if (!spreadsheetId) throw new Error("VALYTICA_CRM_SHEET_ID is not set");

  const tabs = await retry(() => listTabs(spreadsheetId));
  const peopleMeta = tabs.find((t) => t.title === TAB);
  if (!peopleMeta) throw new Error("People tab not found.");

  const grid = await retry(() => readRange(spreadsheetId, `'${TAB}'!A1:BZ6000`));
  const headers = (grid[0] ?? []).map(cell);
  const lastCol = headers.filter(Boolean).length;

  const src = await retry(() =>
    readTabs(spreadsheetId, ["Prospect Intelligence", "Deep Dive Dossiers", "Research Queue"]),
  );
  const pi = indexTab(src.get("Prospect Intelligence") ?? [], /person\s*id/i);
  const dd = indexTab(src.get("Deep Dive Dossiers") ?? [], /prospect\s*\/?\s*contact\s*id|person\s*id/i);
  const rq = indexTab(src.get("Research Queue") ?? [], /person\s*id/i);

  console.log(`People: ${lastCol} columns, grid ${peopleMeta.columnCount} wide`);
  console.log(
    `sources: Prospect Intelligence ${pi.byId.size}, Deep Dive Dossiers ${dd.byId.size}, Research Queue ${rq.byId.size}`,
  );

  // --- columns to add -------------------------------------------------------
  const missing = NEW_COLUMNS.filter((c) => !headers.includes(c));
  console.log(`\ncolumns: ${NEW_COLUMNS.length - missing.length} already present, ${missing.length} to add`);
  missing.forEach((c, i) => console.log(`   + ${colLetter(lastCol + i)}  ${c}`));

  const colIndexOf = new Map<string, number>();
  headers.forEach((h, i) => h && colIndexOf.set(h, i));
  missing.forEach((c, i) => colIndexOf.set(c, lastCol + i));

  // --- the backfill ---------------------------------------------------------
  const pidCol = headers.indexOf("person_id");
  // The real rule, from parse.ts: an uppercase INSTITUTIONAL prefix on EITHER
  // `associations_and_roles` or `specialisation`. Case-sensitive, both columns.
  const markerCols = ["associations_and_roles", "specialisation"].map((c) => headers.indexOf(c));
  const writes: { range: string; value: string }[] = [];
  const touched: string[] = [];
  let fallbackFills = 0;
  let institutional = 0;

  grid.slice(1).forEach((row, i) => {
    const rowNumber = i + 2;
    const pid = cell(row[pidCol]);
    if (!pid) return;

    // is_institutional replaces the "specialisation starts with INSTITUTIONAL"
    // string convention that projectPerson currently keys on.
    if (markerCols.some((c) => c >= 0 && /^\s*INSTITUTIONAL\b/.test(cell(row[c])))) {
      institutional++;
      writes.push({ range: `'${TAB}'!${colLetter(colIndexOf.get("is_institutional")!)}${rowNumber}`, value: "Yes" });
    }

    const p = pi.byId.get(pid);
    const d = dd.byId.get(pid);
    const q = rq.byId.get(pid);
    if (!p && !d && !q) return;

    const put = (column: string, value: string) => {
      if (!value) return;
      const idx = colIndexOf.get(column)!;
      // Never overwrite something already in People.
      if (cell(row[idx]) !== "") return;
      writes.push({ range: `'${TAB}'!${colLetter(idx)}${rowNumber}`, value });
    };

    put("research_status", p?.["Research Status"] || d?.Status || "");
    put("priority", (p?.Priority || "").toUpperCase());
    put("opportunity_score", p?.["Opportunity Score /100"] || "");
    put("score_band", (p?.["Score Band"] || "").toUpperCase());
    put("persona", d?.["Persona / GTM Role"] || p?.["Lead Role"] || "");
    put("best_first_channel", p?.["Best First Channel"] || "");
    put("next_action", q?.["Next Research Task"] || "");
    put("why_now", d?.["Why This Person Now"] || "");
    put("pain", d?.["Pain Narrative"] || "");

    for (const f of FALLBACKS) {
      const idx = colIndexOf.get(f.people);
      if (idx === undefined) continue;
      const have = cell(row[idx]);
      const from = cell(p?.[f.from]);
      if (have === "" && from !== "") {
        writes.push({ range: `'${TAB}'!${colLetter(idx)}${rowNumber}`, value: from });
        fallbackFills++;
      }
    }

    touched.push(pid);
  });

  const people = [...new Set(touched)];
  console.log(`\n${people.length} people matched across the three tabs`);
  console.log(`${writes.length} cell(s) to write`);
  console.log(`   of which ${fallbackFills} fill an existing People column that was blank`);
  console.log(`   ${institutional} row(s) marked is_institutional=Yes`);

  const perColumn = new Map<string, number>();
  for (const w of writes) {
    const letter = w.range.split("!")[1].replace(/\d+/g, "");
    const name = [...colIndexOf.entries()].find(([, i]) => colLetter(i) === letter)?.[0] ?? letter;
    perColumn.set(name, (perColumn.get(name) ?? 0) + 1);
  }
  console.log("\nper column:");
  [...perColumn.entries()].sort((a, b) => b[1] - a[1]).forEach(([n, c]) => console.log(`   ${String(c).padStart(4)}  ${n}`));

  if (!APPLY) {
    console.log("\nDry run. Nothing written. Re-run with --apply.");
    return;
  }

  mkdirSync("tmp", { recursive: true });
  const snap = `tmp/people-before-gtm-fold-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(snap, JSON.stringify({ headers, rows: grid.slice(1).filter((r) => cell(r[pidCol])) }, null, 2));
  console.log(`\nsnapshot: ${snap}`);

  // Widen the grid before writing past its last column.
  if (missing.length && peopleMeta.columnCount < lastCol + missing.length) {
    const token = await getAccessToken();
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            appendDimension: {
              sheetId: peopleMeta.sheetId,
              dimension: "COLUMNS",
              length: lastCol + missing.length - peopleMeta.columnCount,
            },
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`appendDimension → ${res.status}: ${(await res.text()).slice(0, 300)}`);
    console.log(`widened the grid to ${lastCol + missing.length} columns`);
  }

  if (missing.length) {
    await retry(() =>
      writeCells(
        spreadsheetId,
        missing.map((c, i) => ({ range: `'${TAB}'!${colLetter(lastCol + i)}1`, value: c })),
        "RAW",
      ),
    );
    console.log(`wrote ${missing.length} header(s)`);
  }

  for (let i = 0; i < writes.length; i += 200) {
    await retry(() => writeCells(spreadsheetId, writes.slice(i, i + 200), "RAW"));
  }
  console.log(`wrote ${writes.length} cell(s)`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
