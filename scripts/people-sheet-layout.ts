/**
 * Make the People tab readable without moving a single column.
 *
 * 49 columns, of which 31 are under 40% filled, so the thing you came to read
 * is somewhere past a screen and a half of blanks. The fix is collapsible
 * column groups over the contiguous sparse blocks, plus a frozen id + name so
 * scrolling right never loses track of whose row it is.
 *
 * Grouping rather than reordering is the whole point: a group is presentation
 * and reversible from the sheet's own UI, while moving columns rewrites every
 * A1 range anybody has ever written down. Groups only span contiguous columns,
 * which is why the visible set below is "what happens to be left" rather than a
 * designed spine — that is the honest trade.
 *
 * Idempotent: a group that already covers a range is left alone, so re-running
 * does not nest duplicates.
 *
 * `pnpm sheet:people-layout`; `--apply` writes.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { getAccessToken } from "../src/lib/sheet-crm/google-auth";
import { discoverLayouts } from "../src/lib/sheet-crm/sync";

const APPLY = process.argv.includes("--apply");

/** Column letter (A-based) -> zero-based index. */
function col(letter: string): number {
  let n = 0;
  for (const ch of letter) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/**
 * Each group is a contiguous run of columns that is mostly empty on most rows.
 * Fill rates are from the 2026-09-26 audit over 5,611 live rows.
 *
 * Three groups and not six, because **Sheets merges adjacent groups at the same
 * depth**: asking for AA:AF, AG:AK, AL:AQ and AR:AV — which touch end to end —
 * is rejected with "there is no group at depth 1 that spans exactly AG:AK; it
 * is over AA:AK". A dimension group carries no label in Sheets either, so four
 * toggles over one unbroken run would have bought nothing a single toggle does
 * not. The same columns end up hidden either way.
 */
const GROUPS: { label: string; from: string; to: string; why: string }[] = [
  { label: "Company link", from: "N", to: "P", why: "8% / 3% / 8% filled" },
  { label: "PNB panel", from: "T", to: "V", why: "15% / 15% / 11%" },
  {
    label: "Profile, IOV, research, machine keys",
    from: "AA",
    to: "AV",
    why: "22 columns, none above 18% filled; the last five are computed",
  },
];

type DimensionGroup = {
  range: { sheetId: number; dimension: string; startIndex?: number; endIndex?: number };
  depth: number;
  collapsed?: boolean;
};

async function api(path: string, init?: RequestInit) {
  const token = await getAccessToken();
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return res.json();
}

async function main() {
  const spreadsheetId = process.env.VALYTICA_CRM_SHEET_ID;
  if (!spreadsheetId) throw new Error("VALYTICA_CRM_SHEET_ID is not set");

  const people = (await discoverLayouts(spreadsheetId)).layouts.get("people");
  if (!people) throw new Error("People tab not found.");

  const meta = (await api(
    `${spreadsheetId}?fields=sheets(properties(sheetId,title,gridProperties),columnGroups)`,
  )) as {
    sheets: {
      properties: { sheetId: number; title: string; gridProperties?: { frozenRowCount?: number; frozenColumnCount?: number } };
      columnGroups?: DimensionGroup[];
    }[];
  };
  const sheet = meta.sheets.find((s) => s.properties.title === people.title);
  if (!sheet) throw new Error(`Sheet "${people.title}" not found.`);
  const sheetId = sheet.properties.sheetId;
  const existing = sheet.columnGroups ?? [];
  const frozen = sheet.properties.gridProperties ?? {};

  console.log(`${people.title}: ${people.headers.length} columns`);
  console.log(`frozen now: ${frozen.frozenRowCount ?? 0} row(s), ${frozen.frozenColumnCount ?? 0} column(s)`);
  console.log(`existing column groups: ${existing.length}`);

  const requests: Record<string, unknown>[] = [];

  // person_id + full_name stay put when you scroll right; the header row stays
  // put when you scroll down. Without this, a wide row is anonymous.
  if ((frozen.frozenRowCount ?? 0) !== 1 || (frozen.frozenColumnCount ?? 0) !== 2) {
    requests.push({
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1, frozenColumnCount: 2 } },
        fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
      },
    });
    console.log("→ freeze 1 row + 2 columns (person_id, full_name)");
  }

  for (const g of GROUPS) {
    const startIndex = col(g.from);
    const endIndex = col(g.to) + 1;
    const already = existing.some(
      (e) => e.range.dimension === "COLUMNS" && e.range.startIndex === startIndex && e.range.endIndex === endIndex,
    );
    const names = people.headers.slice(startIndex, endIndex).map((h) => String(h ?? "")).join(", ");
    if (already) {
      console.log(`   = ${g.label.padEnd(18)} ${g.from}:${g.to} already grouped`);
      continue;
    }
    requests.push({ addDimensionGroup: { range: { sheetId, dimension: "COLUMNS", startIndex, endIndex } } });
    requests.push({
      updateDimensionGroup: {
        dimensionGroup: { range: { sheetId, dimension: "COLUMNS", startIndex, endIndex }, depth: 1, collapsed: true },
        fields: "collapsed",
      },
    });
    console.log(`   + ${g.label.padEnd(18)} ${g.from}:${g.to}  (${g.why})`);
    console.log(`     ${names}`);
  }

  const groupedCols = GROUPS.reduce((n, g) => n + (col(g.to) - col(g.from) + 1), 0);
  console.log(`\n${groupedCols} of ${people.headers.length} columns collapse into ${GROUPS.length} groups`);
  console.log(`default view: ${people.headers.length - groupedCols} columns`);

  if (!requests.length) {
    console.log("\nNothing to change.");
    return;
  }
  if (!APPLY) {
    console.log(`\nDry run — ${requests.length} request(s). Re-run with --apply.`);
    return;
  }

  await api(`${spreadsheetId}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests }) });
  console.log(`\n✓ applied ${requests.length} request(s)`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
