/**
 * Reconcile the live GTM tabs against the schema in `gtm-model.ts`: add the
 * columns the schema has gained, re-apply every dropdown and date format, and
 * refresh the Guide.
 *
 * It rewrites the header ROW, which is only safe while a tab is empty — so it
 * REFUSES any tab that already holds a data row rather than silently shifting
 * values out from under their headers. Once real data lands, adding a column
 * becomes an insert at a position, which is a different and more careful job.
 *
 * It never drops a column: a header present on the sheet but absent from the
 * schema is reported and left alone. Deleting a column is a decision, not a
 * reconciliation.
 *
 * `pnpm sheet:sync-gtm-columns` to see the plan, `--apply` to write it.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { getAccessToken } from "../src/lib/sheet-crm/google-auth";
import { listTabs, readRange } from "../src/lib/sheet-crm/sheets-api";
import { GTM_TABS, GUIDE_ROWS, VOCAB } from "../src/lib/sheet-crm/gtm-model";

const APPLY = process.argv.includes("--apply");
const c = (v: unknown) => (v ?? "").toString().trim();

const letter = (i: number) => {
  let s = "", n = i;
  while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
  return s;
};

async function main() {
  const spreadsheetId = process.env.VALYTICA_CRM_SHEET_ID;
  if (!spreadsheetId) throw new Error("VALYTICA_CRM_SHEET_ID is not set");

  const token = await getAccessToken();
  const api = async (requests: unknown[]) => {
    if (!requests.length) return;
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ requests }),
    });
    if (!res.ok) throw new Error(`batchUpdate ${res.status}: ${(await res.text()).slice(0, 400)}`);
  };
  const values = async (data: { range: string; values: string[][] }[]) => {
    if (!data.length) return;
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ valueInputOption: "RAW", data }),
    });
    if (!res.ok) throw new Error(`values:batchUpdate ${res.status}: ${(await res.text()).slice(0, 400)}`);
  };

  const live = new Map((await listTabs(spreadsheetId)).map((t) => [t.title, t]));
  const plan: { spec: (typeof GTM_TABS)[number]; meta: NonNullable<ReturnType<typeof live.get>>; added: string[]; orphans: string[] }[] = [];

  console.log(`${APPLY ? "APPLY" : "DRY RUN"}\n`);

  for (const spec of GTM_TABS) {
    const meta = live.get(spec.title);
    if (!meta) { console.log(`MISSING  ${spec.title} — run pnpm sheet:build-gtm-model first`); continue; }

    const header = ((await readRange(spreadsheetId, `'${spec.title}'!A1:BZ1`))[0] ?? []).map(c).filter(Boolean);

    const added = spec.columns.filter((h) => !header.includes(h));
    const orphans = header.filter((h) => !spec.columns.includes(h));

    // The header rewrite is the only unsafe part, so the guard belongs on it and
    // not on the whole tab: a populated tab whose header already matches still
    // wants its dropdowns and date formats re-applied.
    if (added.length && spec.title !== "Guide") {
      const body = (await readRange(spreadsheetId, `'${spec.title}'!A2:BZ50`)).filter((r) => r.some((v) => c(v) !== ""));
      if (body.length) {
        throw new Error(
          `${spec.title} needs ${added.length} new column(s) (${added.join(", ")}) but already holds ${body.length}+ data row(s). Rewriting the header row would shift those values out from under their headers — add the columns with an insert-at-position script instead.`,
        );
      }
    }
    plan.push({ spec, meta, added, orphans });

    const bits = [
      added.length ? `+${added.length}: ${added.join(", ")}` : "no new columns",
      orphans.length ? `LEFT ALONE (not in schema): ${orphans.join(", ")}` : "",
    ].filter(Boolean);
    console.log(`${spec.title.padEnd(21)} ${String(header.length).padStart(2)} -> ${String(spec.columns.length).padStart(2)} cols  ${bits.join("  |  ")}`);
  }

  if (!APPLY) { console.log("\nRe-run with --apply."); return; }

  // Widen any grid that is narrower than its schema before the header write.
  await api(
    plan
      .filter((p) => p.meta.columnCount < p.spec.columns.length)
      .map((p) => ({
        appendDimension: { sheetId: p.meta.sheetId, dimension: "COLUMNS", length: p.spec.columns.length - p.meta.columnCount },
      })),
  );

  await values(
    plan
      .filter((p) => p.added.length)
      .map((p) => ({ range: `'${p.spec.title}'!A1:${letter(p.spec.columns.length - 1)}1`, values: [p.spec.columns] })),
  );

  // The Guide is rewritten wholesale: it is authored content, not collected data.
  await values([
    { range: `'Guide'!A2:C${GUIDE_ROWS.length + 1}`, values: GUIDE_ROWS },
  ]);

  const requests: unknown[] = [];
  for (const { spec, meta } of plan) {
    requests.push({
      repeatCell: {
        range: { sheetId: meta.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: spec.columns.length },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true },
            backgroundColorStyle: { rgbColor: { red: 0.93, green: 0.94, blue: 0.93 } },
            verticalAlignment: "MIDDLE",
          },
        },
        fields: "userEnteredFormat(textFormat,backgroundColorStyle,verticalAlignment)",
      },
    });
    requests.push({
      updateDimensionProperties: {
        range: { sheetId: meta.sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: spec.columns.length },
        properties: { pixelSize: spec.title === "Guide" ? 220 : 170 },
        fields: "pixelSize",
      },
    });
    for (const [header, key] of Object.entries(spec.validate ?? {})) {
      const col = spec.columns.indexOf(header);
      requests.push({
        setDataValidation: {
          range: { sheetId: meta.sheetId, startRowIndex: 1, startColumnIndex: col, endColumnIndex: col + 1 },
          rule: {
            condition: { type: "ONE_OF_LIST", values: (VOCAB[key] as readonly string[]).map((v) => ({ userEnteredValue: v })) },
            showCustomUi: true,
            // Not strict: a value we have not thought of must be enterable, with
            // a warning, or the sheet starts refusing facts about the real world.
            strict: false,
          },
        },
      });
    }
    for (const header of spec.dates ?? []) {
      const col = spec.columns.indexOf(header);
      requests.push({
        repeatCell: {
          range: { sheetId: meta.sheetId, startRowIndex: 1, startColumnIndex: col, endColumnIndex: col + 1 },
          cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "dd-mm-yyyy" } } },
          fields: "userEnteredFormat.numberFormat",
        },
      });
    }
  }
  const guide = plan.find((p) => p.spec.title === "Guide");
  if (guide) {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId: guide.meta.sheetId, dimension: "COLUMNS", startIndex: 2, endIndex: 3 },
        properties: { pixelSize: 760 },
        fields: "pixelSize",
      },
    });
  }
  await api(requests);

  console.log(`\nsynced ${plan.length} tab(s); Guide rewritten with ${GUIDE_ROWS.filter((r) => r[0]).length} entries`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
