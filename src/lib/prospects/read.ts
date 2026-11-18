import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { isGoogleConfigured } from "./google-auth";
import { listTabs, readTabs } from "./sheets-api";
import { parseWorkbook, type ProspectsWorkbook } from "./parse";
import { prospectsSheetId, TAB } from "./schema";
import { packSnapshot, snapshotOf, unpackSnapshot, type PackedSnapshot, type ProspectsSnapshot } from "./snapshot";

export const PROSPECTS_TAG = "prospects-sheet";

/**
 * The whole workbook, read straight from Google Sheets. People edit the sheet
 * directly, so the cache is short (a minute) — and every dashboard write
 * expires it at once so the writer sees their own change.
 *
 * Whole records (notes, drafts, research) come to ~6 MB, too big for the
 * shared cache's 2 MB entries, so this stays in each instance's memory. Only
 * what needs whole records reads it: one prospect's detail and related rows,
 * the phone's queue. Pages that list prospects read `loadProspectSnapshot`.
 */
export async function loadWorkbook(): Promise<ProspectsWorkbook> {
  "use cache";
  cacheTag(PROSPECTS_TAG);
  cacheLife("minutes");
  return readWorkbook();
}

/**
 * Every record as its list row, plus Activity, in the shared cache: the sheet
 * is read once a minute across all instances instead of once per instance.
 * Same tag and lifetime as the workbook, so a write expires both. Rows are
 * stored as arrays (~0.55 MB) to stay well under the 2 MB entry limit.
 */
async function loadPackedSnapshot(): Promise<PackedSnapshot> {
  "use cache: remote";
  cacheTag(PROSPECTS_TAG);
  cacheLife("minutes");
  return packSnapshot(snapshotOf(await readWorkbook()));
}

/** What Sales (its Customers tab too) and the scorecard read from the sheet. */
export async function loadProspectSnapshot(): Promise<ProspectsSnapshot> {
  return unpackSnapshot(await loadPackedSnapshot());
}

async function readWorkbook(): Promise<ProspectsWorkbook> {
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
