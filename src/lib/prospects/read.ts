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
    return { valuers: [], firms: [], rvos: [], panels: [], banks: [], activity: [], warnings: ["Google service account is not configured (GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY)."], readAt: new Date().toISOString() };
  }
  const id = prospectsSheetId();
  const all = [TAB.valuer, TAB.firm, TAB.rvo, TAB.panel, TAB.bank, TAB.activity];
  let tabs: Map<string, unknown[][]>;
  try {
    // Every tab normally exists, so read them all in one call rather than
    // listing the tabs first and reading second.
    tabs = await readTabs(id, all);
  } catch {
    // A missing tab fails the whole batch read; fall back to reading only the
    // tabs that are there. (A real failure — bad sheet id, no access — throws
    // again from listTabs, with its explanation.)
    const present = new Set((await listTabs(id)).map((t) => t.title));
    tabs = await readTabs(id, all.filter((t) => present.has(t)));
  }
  return parseWorkbook(tabs, new Date().toISOString());
}
