/**
 * Delete a tab, after snapshotting every cell of it to `tmp/`.
 *
 * Deleting a tab is the one irreversible operation in this toolkit, so it
 * refuses by default and takes three deliberate steps: name the tab, confirm it
 * is not referenced by a formula anywhere else in the workbook, and pass
 * `--apply`.
 *
 * The cross-tab reference check is the load-bearing one. A tab can look
 * disposable and still be what another tab counts: `Summary` referenced
 * `IOV Memberships`, `Lender Contacts` and `Association Officers`, none of which
 * is obvious from looking at those tabs. Deleting a referenced tab leaves
 * `#REF!` in a formula somebody trusts.
 *
 * `pnpm sheet:delete-tab --tab="Summary"`; `--apply` deletes.
 * `--force` proceeds despite inbound references (you must then fix them).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "node:fs";

import { getAccessToken } from "../src/lib/sheet-crm/google-auth";

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");
const TAB = process.argv.find((a) => a.startsWith("--tab="))?.split("=")[1]?.replace(/^["']|["']$/g, "");

const c = (v: unknown) => (v ?? "").toString();

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${path.slice(0, 60)} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json() as Promise<T>;
}

async function main() {
  const spreadsheetId = process.env.VALYTICA_CRM_SHEET_ID;
  if (!spreadsheetId) throw new Error("VALYTICA_CRM_SHEET_ID is not set");
  if (!TAB) throw new Error(`Name the tab: --tab="Summary"`);

  type Sheet = {
    properties: { sheetId: number; title: string };
    data?: { rowData?: { values?: { formattedValue?: string; userEnteredValue?: { formulaValue?: string } }[] }[] }[];
  };
  const meta = await api<{ sheets: Sheet[] }>(
    `${spreadsheetId}?includeGridData=true&fields=sheets(properties(sheetId,title),data(rowData(values(formattedValue,userEnteredValue))))`,
  );
  const target = meta.sheets.find((s) => s.properties.title === TAB);
  if (!target) throw new Error(`No tab titled "${TAB}". Tabs: ${meta.sheets.map((s) => s.properties.title).join(", ")}`);

  // Who points AT this tab?
  const inbound: { tab: string; formula: string }[] = [];
  for (const s of meta.sheets) {
    if (s.properties.title === TAB) continue;
    for (const row of s.data?.[0]?.rowData ?? []) {
      for (const cell of row.values ?? []) {
        const f = cell?.userEnteredValue?.formulaValue;
        if (f && (f.includes(`'${TAB}'!`) || f.includes(`${TAB}!`))) inbound.push({ tab: s.properties.title, formula: f.slice(0, 120) });
      }
    }
  }

  const rows = (target.data?.[0]?.rowData ?? []).map((r) => (r.values ?? []).map((v) => c(v?.formattedValue)));
  const live = rows.filter((r) => r.some((x) => x.trim()));
  console.log(`"${TAB}" — ${live.length} non-empty row(s), sheetId ${target.properties.sheetId}`);

  if (inbound.length) {
    console.log(`\n*** ${inbound.length} formula(s) on other tabs reference it:`);
    inbound.slice(0, 8).forEach((i) => console.log(`    ${i.tab}: ${i.formula}`));
    if (!FORCE) {
      console.log(`\nRefusing. Deleting this tab would leave #REF! in those formulas.`);
      console.log(`Fix them first, or pass --force if you have.`);
      process.exitCode = 1;
      return;
    }
    console.log(`\n--force given; proceeding despite the references above.`);
  } else {
    console.log(`no formula on any other tab references it`);
  }

  if (!APPLY) {
    console.log(`\nDry run. Nothing deleted. Re-run with --apply.`);
    return;
  }

  mkdirSync("tmp", { recursive: true });
  const snap = `tmp/deleted-tab-${TAB.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(snap, JSON.stringify({ tab: TAB, rows }, null, 2));
  console.log(`\nsnapshot: ${snap}`);

  await api(`${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests: [{ deleteSheet: { sheetId: target.properties.sheetId } }] }),
  });

  const after = await api<{ sheets: { properties: { title: string } }[] }>(`${spreadsheetId}?fields=sheets.properties.title`);
  const titles = after.sheets.map((s) => s.properties.title);
  console.log(titles.includes(TAB) ? `*** "${TAB}" IS STILL PRESENT` : `deleted. ${titles.length} tabs remain: ${titles.join(", ")}`);
  if (titles.includes(TAB)) process.exitCode = 1;
}

main().then(() => process.exit(process.exitCode ?? 0)).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
