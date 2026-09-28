import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { isGoogleConfigured } from "./google-auth";
import { listTabs, readTabs } from "./sheets-api";
import { parseWorkbook, type ProspectsWorkbook } from "./parse";
import { prospectsSheetId, TAB } from "./schema";

export const PROSPECTS_TAG = "prospects-sheet";

/**
 * The whole workbook, read straight from Google Sheets. People edit the sheet
 * directly, so the cache is short (a minute) — and every dashboard write
 * expires it at once so the writer sees their own change.
 */
export async function loadWorkbook(): Promise<ProspectsWorkbook> {
  "use cache";
  cacheTag(PROSPECTS_TAG);
  cacheLife("minutes");

  if (!isGoogleConfigured()) {
    return { valuers: [], firms: [], rvos: [], activity: [], warnings: ["Google service account is not configured (GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY)."], readAt: new Date().toISOString() };
  }
  const id = prospectsSheetId();
  const present = new Set((await listTabs(id)).map((t) => t.title));
  const wanted = [TAB.valuer, TAB.firm, TAB.rvo, TAB.activity].filter((t) => present.has(t));
  const tabs = await readTabs(id, wanted);
  return parseWorkbook(tabs, new Date().toISOString());
}
