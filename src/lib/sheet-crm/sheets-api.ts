
import { getAccessToken } from "./google-auth";

/**
 * The four Sheets API calls the sync needs, over plain `fetch`. Every call
 * throws on a non-2xx so the sync run records the failure instead of
 * mistaking it for an empty tab.
 */

const BASE = "https://sheets.googleapis.com/v4/spreadsheets";

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 500);
    // The two failures every first run hits, neither of which the raw body names.
    if (res.status === 404) {
      throw new Error(
        `Sheets API 404 for spreadsheet ${path.split("?")[0].split("/")[0]}. Either VALYTICA_CRM_SHEET_ID is wrong, or the workbook has not been shared with ${process.env.GOOGLE_SA_EMAIL ?? "the service account"} as an Editor.`,
      );
    }
    if (res.status === 403 && body.includes("has not been used in project")) {
      throw new Error(`Sheets API is not enabled in this Google Cloud project. Enable "Google Sheets API" under APIs & Services → Library, then retry. (${body})`);
    }
    throw new Error(`Sheets API ${init.method ?? "GET"} ${path.split("?")[0]} → ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

export type SheetTabMeta = { title: string; sheetId: number; rowCount: number; columnCount: number };

export async function listTabs(spreadsheetId: string): Promise<SheetTabMeta[]> {
  const json = await call<{ sheets: { properties: { title: string; sheetId: number; gridProperties: { rowCount: number; columnCount: number } } }[] }>(
    `${spreadsheetId}?fields=sheets.properties(title,sheetId,gridProperties(rowCount,columnCount))`,
  );
  return json.sheets.map((s) => ({
    title: s.properties.title,
    sheetId: s.properties.sheetId,
    rowCount: s.properties.gridProperties?.rowCount ?? 0,
    columnCount: s.properties.gridProperties?.columnCount ?? 0,
  }));
}

const quote = (title: string) => `'${title.replace(/'/g, "''")}'`;

/** Every cell of the given tabs, unformatted, as string/number/boolean matrices. */
export async function readTabs(spreadsheetId: string, titles: string[]): Promise<Map<string, unknown[][]>> {
  const out = new Map<string, unknown[][]>();
  // batchGet takes the ranges in the query string; keep each request to a
  // handful of tabs so the URL stays short.
  for (let i = 0; i < titles.length; i += 6) {
    const chunk = titles.slice(i, i + 6);
    const qs = chunk.map((t) => `ranges=${encodeURIComponent(quote(t))}`).join("&");
    const json = await call<{ valueRanges: { range: string; values?: unknown[][] }[] }>(
      `${spreadsheetId}/values:batchGet?${qs}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING&majorDimension=ROWS`,
    );
    json.valueRanges.forEach((vr, j) => out.set(chunk[j], vr.values ?? []));
  }
  return out;
}

/**
 * Column-level formula map for a tab, learned from a sample of its leading
 * data rows: a column whose sampled cells carry a formula is treated as
 * derived whatever the mapping says. Returns the set of 0-based column
 * indexes that hold formulas.
 */
export async function formulaColumns(spreadsheetId: string, title: string, headerRow0: number, sampleRows = 4): Promise<Set<number>> {
  const from = headerRow0 + 2;
  const to = headerRow0 + 1 + sampleRows;
  const range = `${quote(title)}!${from}:${to}`;
  const json = await call<{ sheets?: { data?: { rowData?: { values?: { userEnteredValue?: { formulaValue?: string } }[] }[] }[] }[] }>(
    `${spreadsheetId}?ranges=${encodeURIComponent(range)}&includeGridData=true&fields=sheets.data.rowData.values.userEnteredValue.formulaValue`,
  );
  const set = new Set<number>();
  for (const sheet of json.sheets ?? [])
    for (const data of sheet.data ?? [])
      for (const row of data.rowData ?? [])
        (row.values ?? []).forEach((cell, i) => {
          if (cell.userEnteredValue?.formulaValue) set.add(i);
        });
  return set;
}

/** Whether ONE cell currently carries a formula. Checked before every write. */
export async function cellHasFormula(spreadsheetId: string, a1Range: string): Promise<boolean> {
  const json = await call<{ sheets?: { data?: { rowData?: { values?: { userEnteredValue?: { formulaValue?: string } }[] }[] }[] }[] }>(
    `${spreadsheetId}?ranges=${encodeURIComponent(a1Range)}&includeGridData=true&fields=sheets.data.rowData.values.userEnteredValue.formulaValue`,
  );
  return Boolean(json.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0]?.userEnteredValue?.formulaValue);
}

/** Read one range (e.g. a key column or the leading rows of a tab). */
export async function readRange(spreadsheetId: string, a1Range: string): Promise<unknown[][]> {
  const json = await call<{ values?: unknown[][] }>(
    `${spreadsheetId}/values/${encodeURIComponent(a1Range)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`,
  );
  return json.values ?? [];
}

/** Write cells. RAW keeps text literal (leading zeros survive); USER_ENTERED lets numbers be numbers. */
export async function writeCells(
  spreadsheetId: string,
  cells: { range: string; value: string | number | null }[],
  mode: "RAW" | "USER_ENTERED" = "RAW",
): Promise<void> {
  if (!cells.length) return;
  await call(`${spreadsheetId}/values:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      valueInputOption: mode,
      data: cells.map((c) => ({ range: c.range, values: [[c.value ?? ""]] })),
    }),
  });
}

/** Append rows at the bottom of a tab (used only for owner-approved inserts). */
export async function appendRows(spreadsheetId: string, title: string, rows: (string | number | null)[][]): Promise<void> {
  if (!rows.length) return;
  await call(`${spreadsheetId}/values/${encodeURIComponent(quote(title))}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    body: JSON.stringify({ values: rows }),
  });
}
