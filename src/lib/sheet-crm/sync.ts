
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";

import { db } from "@/db";
import { crmAccounts, crmContacts, interactions, sheetCellWrites, sheetRows, sheetSyncRuns } from "@/db/schema";
import { wsTags } from "@/lib/cache-tags";
import { isSheetSyncConfigured, sheetId as configuredSheetId } from "./google-auth";
import {
  TAB_SPECS,
  TAB_SPEC_BY_ID,
  a1,
  columnSpec,
  headerDrift,
  identifyTab,
  isWritableColumn,
  rowKeyFor,
  type HeaderDrift,
  type TabId,
  type TabSpec,
} from "./mapping";
import { cellString, isBlankRow, rowHash, rowToRecord } from "./parse";
import { projectCompany, projectPerson, SHEET_SOURCE, type SheetRecord } from "./projection";
import { cellHasFormula, formulaColumns, listTabs, readRange, readTabs, writeCells } from "./sheets-api";

/**
 * The sync engine. Two directions, one rule each:
 *
 *   pull  — the sheet is read in full, every tab identified by its header row,
 *           every row hashed, and only changed rows written to `sheet_rows`;
 *           People and Companies are then projected onto crm_contacts /
 *           crm_accounts by person_id / company_id.
 *   push  — one edit in Internal becomes one cell write in the sheet, the row
 *           located by its id AT WRITE TIME (never a remembered row number),
 *           refused when the cell carries a formula or the column is not
 *           declared writable.
 *
 * Neon HTTP has no transactions, so every step is idempotent and batched.
 */

export type TabLayout = {
  spec: TabSpec;
  title: string;
  headerRow0: number;
  headers: string[];
  formulaCols: Set<number>;
};

export type TabSummary = {
  title: string;
  headerRow: number;
  rows: number;
  changed: number;
  added: number;
  removed: number;
  weakKeys: number;
  unkeyed: number;
  duplicateKeys: string[];
  formulaColumns: string[];
  drift: HeaderDrift;
};

export type SyncSummary = {
  tabs: Partial<Record<TabId, TabSummary>>;
  unmatchedSheets: string[];
  missingTabs: TabId[];
  contactsUpserted: number;
  accountsUpserted: number;
  interactionsLogged: number;
};

const BATCH = 100;

function invalidate(workspaceId: string) {
  // Outside a request scope (the reconcile script, tests) there is no cache to expire.
  try {
    for (const tag of wsTags(workspaceId, "sheet", "crm", "interactions")) revalidateTag(tag, { expire: 0 });
  } catch {
    /* not in a request */
  }
}

/** Identify every sheet in the workbook and learn its layout. Exposed for the probe script. */
export async function discoverLayouts(spreadsheetId: string): Promise<{ layouts: Map<TabId, TabLayout>; unmatched: string[] }> {
  const tabs = await listTabs(spreadsheetId);
  const titles = tabs.map((t) => t.title);
  // Only the leading rows are needed to identify a tab.
  const heads = new Map<string, unknown[][]>();
  for (const t of titles) heads.set(t, await readRange(spreadsheetId, `'${t.replace(/'/g, "''")}'!1:6`));
  const layouts = new Map<TabId, TabLayout>();
  const unmatched: string[] = [];
  for (const title of titles) {
    const hit = identifyTab(heads.get(title) ?? []);
    if (!hit || layouts.has(hit.spec.id)) {
      unmatched.push(title);
      continue;
    }
    const formulaCols = await formulaColumns(spreadsheetId, title, hit.rowIndex);
    layouts.set(hit.spec.id, { spec: hit.spec, title, headerRow0: hit.rowIndex, headers: hit.headers, formulaCols });
  }
  return { layouts, unmatched };
}

type ParsedRow = { key: string; weak: boolean; record: SheetRecord; hash: string; personId: string | null; companyId: string | null };

function parseTab(layout: TabLayout, values: unknown[][]): { rows: ParsedRow[]; unkeyed: number; duplicateKeys: string[] } {
  const { spec, headers, headerRow0 } = layout;
  const seen = new Map<string, number>();
  const rows: ParsedRow[] = [];
  const duplicateKeys: string[] = [];
  let unkeyed = 0;
  for (let i = headerRow0 + 1; i < values.length; i++) {
    const raw = values[i] ?? [];
    if (isBlankRow(raw)) continue;
    const record = rowToRecord(headers, raw);
    const k = rowKeyFor(spec, record);
    if (!k) {
      unkeyed++;
      continue;
    }
    let key = k.key;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    if (n > 1) {
      duplicateKeys.push(key);
      key = `${key}#${n}`;
    }
    // A GTM tab's id cell carries things like "N/A" for a deliberately
    // unlinked row. Only a well-formed id becomes a foreign key; anything
    // else leaves the row keyed by name and visibly unlinked.
    const rawPid = spec.personIdColumn ? (record[spec.personIdColumn] ?? "").trim() : "";
    const rawCid = spec.companyIdColumn ? (record[spec.companyIdColumn] ?? "").trim() : "";
    const personId = /^P\d{5}$/.test(rawPid) ? rawPid : null;
    const companyId = /^C\d{4}$/.test(rawCid) ? rawCid : null;
    rows.push({ key, weak: k.weak, record, hash: rowHash(headers.map((_, j) => raw[j])), personId, companyId });
  }
  return { rows, unkeyed, duplicateKeys };
}

/** Full pull. Returns the run id and summary; throws only on a total failure (recorded on the run). */
export async function pullSheet(
  workspaceId: string,
  trigger: "cron" | "manual" | "ping" | "api" = "cron",
  opts: { onlyTabs?: TabId[] } = {},
): Promise<{ runId: string; summary: SyncSummary }> {
  if (!isSheetSyncConfigured()) throw new Error("Sheet sync is not configured.");
  const spreadsheetId = configuredSheetId();
  const [run] = await db
    .insert(sheetSyncRuns)
    .values({ workspaceId, sheetId: spreadsheetId, trigger })
    .returning({ id: sheetSyncRuns.id });

  const summary: SyncSummary = {
    tabs: {},
    unmatchedSheets: [],
    missingTabs: [],
    contactsUpserted: 0,
    accountsUpserted: 0,
    interactionsLogged: 0,
  };
  try {
    const { layouts, unmatched } = await discoverLayouts(spreadsheetId);
    summary.unmatchedSheets = unmatched;
    summary.missingTabs = TAB_SPECS.map((t) => t.id).filter((id) => !layouts.has(id));

    const wanted = [...layouts.values()].filter((l) => !opts.onlyTabs || opts.onlyTabs.includes(l.spec.id));
    const values = await readTabs(spreadsheetId, wanted.map((l) => l.title));

    const parsedByTab = new Map<TabId, ParsedRow[]>();
    for (const layout of wanted) {
      const { rows, unkeyed, duplicateKeys } = parseTab(layout, values.get(layout.title) ?? []);
      parsedByTab.set(layout.spec.id, rows);
      const changes = await upsertTabRows(workspaceId, spreadsheetId, layout, rows);
      summary.tabs[layout.spec.id] = {
        title: layout.title,
        headerRow: layout.headerRow0 + 1,
        rows: rows.length,
        unkeyed,
        duplicateKeys,
        weakKeys: rows.filter((r) => r.weak).length,
        formulaColumns: [...layout.formulaCols].map((i) => layout.headers[i]).filter(Boolean),
        drift: headerDrift(layout.spec, layout.headers),
        ...changes,
      };
      summary.interactionsLogged += changes.interactionsLogged;
    }

    // Projections need People + the GTM tabs; when only a subset was pulled,
    // read the rest from the mirror so a targeted ping still projects correctly.
    const need = async (id: TabId): Promise<ParsedRow[]> => {
      const have = parsedByTab.get(id);
      if (have) return have;
      const rows = await db
        .select({ key: sheetRows.rowKey, weak: sheetRows.weakKey, record: sheetRows.data, hash: sheetRows.rowHash, personId: sheetRows.personId, companyId: sheetRows.companyId })
        .from(sheetRows)
        .where(and(eq(sheetRows.workspaceId, workspaceId), eq(sheetRows.sheetId, spreadsheetId), eq(sheetRows.tab, id), isNull(sheetRows.deletedAt)));
      return rows;
    };
    if (parsedByTab.has("companies")) summary.accountsUpserted = await projectCompanies(workspaceId, await need("companies"));
    if (parsedByTab.has("people") || parsedByTab.has("prospect_intelligence") || parsedByTab.has("deep_dive_dossiers")) {
      summary.contactsUpserted = await projectPeople(workspaceId, await need("people"), await need("companies"));
    }

    await db
      .update(sheetSyncRuns)
      .set({ status: "ok", finishedAt: new Date(), summary: summary as unknown as Record<string, unknown> })
      .where(eq(sheetSyncRuns.id, run.id));
    invalidate(workspaceId);
    return { runId: run.id, summary };
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 2000) : String(err);
    await db
      .update(sheetSyncRuns)
      .set({ status: "failed", finishedAt: new Date(), error: message, summary: summary as unknown as Record<string, unknown> })
      .where(eq(sheetSyncRuns.id, run.id));
    invalidate(workspaceId);
    throw err;
  }
}

async function upsertTabRows(
  workspaceId: string,
  spreadsheetId: string,
  layout: TabLayout,
  rows: ParsedRow[],
): Promise<{ changed: number; added: number; removed: number; interactionsLogged: number }> {
  const tab = layout.spec.id;
  const isMaster = tab === "people" || tab === "companies";
  // Masters are large: compare by hash only. Small tabs keep their old data so
  // a research change can be described on the person's timeline.
  const existing = await db
    .select({ id: sheetRows.id, rowKey: sheetRows.rowKey, rowHash: sheetRows.rowHash, deletedAt: sheetRows.deletedAt, personId: sheetRows.personId, companyId: sheetRows.companyId, data: isMaster ? sql<null>`null` : sheetRows.data })
    .from(sheetRows)
    .where(and(eq(sheetRows.workspaceId, workspaceId), eq(sheetRows.sheetId, spreadsheetId), eq(sheetRows.tab, tab)));
  const byKey = new Map(existing.map((e) => [e.rowKey, e]));

  const toWrite: ParsedRow[] = [];
  const changedRecords: { row: ParsedRow; before: SheetRecord | null }[] = [];
  let added = 0;
  for (const r of rows) {
    const prev = byKey.get(r.key);
    if (!prev) {
      added++;
      toWrite.push(r);
      changedRecords.push({ row: r, before: null });
    } else if (prev.rowHash !== r.hash || prev.deletedAt) {
      toWrite.push(r);
      changedRecords.push({ row: r, before: prev.data as SheetRecord | null });
    }
  }
  const now = new Date();
  for (let i = 0; i < toWrite.length; i += BATCH) {
    const chunk = toWrite.slice(i, i + BATCH);
    await db
      .insert(sheetRows)
      .values(
        chunk.map((r) => ({
          workspaceId,
          sheetId: spreadsheetId,
          tab,
          rowKey: r.key,
          weakKey: r.weak,
          personId: r.personId,
          companyId: r.companyId,
          data: r.record,
          rowHash: r.hash,
          syncedAt: now,
          deletedAt: null,
        })),
      )
      .onConflictDoUpdate({
        target: [sheetRows.workspaceId, sheetRows.sheetId, sheetRows.tab, sheetRows.rowKey],
        set: {
          weakKey: sql`excluded.weak_key`,
          personId: sql`excluded.person_id`,
          companyId: sql`excluded.company_id`,
          data: sql`excluded.data`,
          rowHash: sql`excluded.row_hash`,
          syncedAt: sql`excluded.synced_at`,
          deletedAt: null,
        },
      });
  }

  const present = new Set(rows.map((r) => r.key));
  const goneRows = existing.filter((e) => !present.has(e.rowKey) && !e.deletedAt);
  const gone = goneRows.map((e) => e.id);
  for (let i = 0; i < gone.length; i += BATCH) {
    await db.update(sheetRows).set({ deletedAt: now }).where(inArray(sheetRows.id, gone.slice(i, i + BATCH)));
  }

  // The projection has to go with the row. Marking `sheetRows.deletedAt` and
  // stopping left the projected contact behind for good: 52 people who are not
  // in the sheet any more were still in the app, three of them assigned to
  // someone. The sheet is the source of truth, so a person who left it is not a
  // contact — and `interactions`/`crm_activities` cascade, which is right here
  // ONLY because a merge re-points that history onto the surviving contact
  // first (see `scripts/merge-duplicate-people.ts`). Deleting a person the
  // sheet no longer has, without a merge, is the sheet's decision to honour.
  const gonePersonIds = goneRows.map((e) => e.personId).filter((v): v is string => Boolean(v));
  let projectionsRemoved = 0;
  for (let i = 0; i < gonePersonIds.length; i += BATCH) {
    const slice = gonePersonIds.slice(i, i + BATCH);
    const removed = await db
      .delete(crmContacts)
      .where(
        and(
          eq(crmContacts.workspaceId, workspaceId),
          eq(crmContacts.externalSource, SHEET_SOURCE),
          inArray(crmContacts.externalId, slice),
        ),
      )
      .returning({ id: crmContacts.id });
    projectionsRemoved += removed.length;
  }

  const goneCompanyIds = goneRows.map((e) => e.companyId).filter((v): v is string => Boolean(v));
  for (let i = 0; i < goneCompanyIds.length; i += BATCH) {
    const slice = goneCompanyIds.slice(i, i + BATCH);
    const removed = await db
      .delete(crmAccounts)
      .where(
        and(
          eq(crmAccounts.workspaceId, workspaceId),
          eq(crmAccounts.externalSource, SHEET_SOURCE),
          inArray(crmAccounts.externalId, slice),
        ),
      )
      .returning({ id: crmAccounts.id });
    projectionsRemoved += removed.length;
  }
  if (projectionsRemoved > 0) {
    console.log(`[sheet-sync] ${tab}: removed ${projectionsRemoved} projection(s) for deleted rows`);
  }

  // Research changes on a person become timeline entries (masters excluded:
  // a phone correction is data, not an event).
  let interactionsLogged = 0;
  if (!isMaster && layout.spec.personIdColumn) {
    const withPerson = changedRecords.filter((c) => c.row.personId);
    if (withPerson.length) {
      const ids = [...new Set(withPerson.map((c) => c.row.personId!))];
      const contacts = await db
        .select({ id: crmContacts.id, externalId: crmContacts.externalId })
        .from(crmContacts)
        .where(and(eq(crmContacts.workspaceId, workspaceId), eq(crmContacts.externalSource, SHEET_SOURCE), inArray(crmContacts.externalId, ids)));
      const contactByPid = new Map(contacts.map((c) => [c.externalId!, c.id]));
      const entries = withPerson
        .map((c) => {
          const contactId = contactByPid.get(c.row.personId!);
          if (!contactId) return null;
          const changed = c.before
            ? Object.keys(c.row.record).filter((k) => (c.before![k] ?? "") !== (c.row.record[k] ?? ""))
            : ["(row added)"];
          if (!changed.length) return null;
          return {
            workspaceId,
            contactId,
            channel: "sheet_change",
            direction: "none",
            occurredAt: now,
            subject: `${layout.title}: ${changed.slice(0, 4).join(", ")}${changed.length > 4 ? ` +${changed.length - 4}` : ""}`,
            summary: c.before ? null : "Row added in the sheet",
            source: "sheet-sync",
            externalRef: `${tab}:${c.row.key}:${c.row.hash.slice(0, 16)}`,
            meta: { tab, rowKey: c.row.key, changedColumns: changed },
          };
        })
        .filter((e): e is NonNullable<typeof e> => Boolean(e));
      for (let i = 0; i < entries.length; i += BATCH) {
        const res = await db
          .insert(interactions)
          .values(entries.slice(i, i + BATCH))
          .onConflictDoNothing()
          .returning({ id: interactions.id });
        interactionsLogged += res.length;
      }
    }
  }

  return { changed: toWrite.length - added, added, removed: gone.length, interactionsLogged };
}

async function projectCompanies(workspaceId: string, companies: ParsedRow[]): Promise<number> {
  let n = 0;
  for (let i = 0; i < companies.length; i += BATCH) {
    const chunk = companies.slice(i, i + BATCH).map((r) => projectCompany(r.record));
    if (!chunk.length) continue;
    await db
      .insert(crmAccounts)
      .values(
        chunk.map((c) => ({
          workspaceId,
          name: c.name,
          website: c.website,
          industry: c.industry,
          type: "prospect",
          entity: c.entity,
          externalSource: c.externalSource,
          externalId: c.externalId,
          city: c.city,
          state: c.state,
          ibbiEntityRegNo: c.ibbiEntityRegNo,
          constitution: c.constitution,
          pnbCategory: c.pnbCategory,
          researchConfidence: c.researchConfidence,
          ...(c.outreachStatus ? { outreachStatus: c.outreachStatus } : {}),
          ...(c.lastContactedAt ? { lastContactedAt: c.lastContactedAt } : {}),
        })),
      )
      .onConflictDoUpdate({
        target: [crmAccounts.workspaceId, crmAccounts.externalSource, crmAccounts.externalId],
        set: {
          name: sql`excluded.name`,
          website: sql`excluded.website`,
          city: sql`excluded.city`,
          state: sql`excluded.state`,
          ibbiEntityRegNo: sql`excluded.ibbi_entity_reg_no`,
          constitution: sql`excluded.constitution`,
          pnbCategory: sql`excluded.pnb_category`,
          researchConfidence: sql`excluded.research_confidence`,
          // Internal-owned columns: the sheet's value wins only when the owner has filled it.
          outreachStatus: sql`coalesce(nullif(excluded.outreach_status, 'not_planned'), ${crmAccounts.outreachStatus})`,
          lastContactedAt: sql`coalesce(excluded.last_contacted_at, ${crmAccounts.lastContactedAt})`,
        },
      });
    n += chunk.length;
  }
  return n;
}

async function projectPeople(
  workspaceId: string,
  people: ParsedRow[],
  companies: ParsedRow[],
): Promise<number> {
  // person_id → company_id from the id-based link on Companies.
  const companyOfPerson = new Map<string, string>();
  for (const c of companies) for (const pid of projectCompany(c.record).linkedPersonIds) if (!companyOfPerson.has(pid)) companyOfPerson.set(pid, c.key);
  const accounts = await db
    .select({ id: crmAccounts.id, externalId: crmAccounts.externalId })
    .from(crmAccounts)
    .where(and(eq(crmAccounts.workspaceId, workspaceId), eq(crmAccounts.externalSource, SHEET_SOURCE)));
  const accountByCid = new Map(accounts.map((a) => [a.externalId!, a.id]));

  let n = 0;
  for (let i = 0; i < people.length; i += BATCH) {
    const chunk = people.slice(i, i + BATCH).map((r) => ({
      row: r,
      p: projectPerson(r.record),
    }));
    if (!chunk.length) continue;
    await db
      .insert(crmContacts)
      .values(
        chunk.map(({ row, p }) => ({
          workspaceId,
          accountId: accountByCid.get(companyOfPerson.get(row.key) ?? "") ?? null,
          name: p.name,
          email: p.email,
          title: p.title,
          phone: p.phone,
          phoneE164: p.phoneE164,
          lifecycleStage: "lead",
          source: p.source,
          leadScore: p.leadScore,
          channel: p.channel,
          entity: p.entity,
          externalSource: p.externalSource,
          externalId: p.externalId,
          city: p.city,
          state: p.state,
          ibbiRegNo: p.ibbiRegNo,
          rvo: p.rvo,
          priority: p.priority,
          opportunityScore: p.opportunityScore,
          scoreBand: p.scoreBand,
          researchStatus: p.researchStatus,
          bestFirstChannel: p.bestFirstChannel,
          persona: p.persona,
          sheetDuplicate: p.sheetDuplicate,
          ...(p.outreachStatus ? { outreachStatus: p.outreachStatus } : {}),
          ...(p.lastContactedAt ? { lastContactedAt: p.lastContactedAt } : {}),
        })),
      )
      .onConflictDoUpdate({
        target: [crmContacts.workspaceId, crmContacts.externalSource, crmContacts.externalId],
        set: {
          accountId: sql`coalesce(excluded.account_id, ${crmContacts.accountId})`,
          name: sql`excluded.name`,
          email: sql`excluded.email`,
          title: sql`excluded.title`,
          phone: sql`excluded.phone`,
          phoneE164: sql`excluded.phone_e164`,
          source: sql`excluded.source`,
          leadScore: sql`excluded.lead_score`,
          channel: sql`excluded.channel`,
          city: sql`excluded.city`,
          state: sql`excluded.state`,
          ibbiRegNo: sql`excluded.ibbi_reg_no`,
          rvo: sql`excluded.rvo`,
          priority: sql`excluded.priority`,
          opportunityScore: sql`excluded.opportunity_score`,
          scoreBand: sql`excluded.score_band`,
          researchStatus: sql`excluded.research_status`,
          bestFirstChannel: sql`excluded.best_first_channel`,
          persona: sql`excluded.persona`,
          sheetDuplicate: sql`excluded.sheet_duplicate`,
          outreachStatus: sql`coalesce(nullif(excluded.outreach_status, 'not_planned'), ${crmContacts.outreachStatus})`,
          lastContactedAt: sql`coalesce(excluded.last_contacted_at, ${crmContacts.lastContactedAt})`,
        },
      });
    n += chunk.length;
  }
  return n;
}

// ---- push: write-through of one row's cells ----

export type CellWriteStatus =
  | "ok"
  | "pending"
  | "refused_formula"
  | "refused_readonly"
  | "column_absent"
  | "row_not_found"
  | "failed";

export type CellWriteResult = { column: string; status: CellWriteStatus; detail?: string };

/** Locate a tab's live layout (header row + columns) by its header signature. */
async function locateTab(spreadsheetId: string, tabId: TabId, hintTitle?: string): Promise<TabLayout | null> {
  const spec = TAB_SPEC_BY_ID[tabId];
  const tryTitle = async (title: string): Promise<TabLayout | null> => {
    const head = await readRange(spreadsheetId, `'${title.replace(/'/g, "''")}'!1:6`);
    const hit = identifyTab(head);
    if (!hit || hit.spec.id !== tabId) return null;
    return { spec, title, headerRow0: hit.rowIndex, headers: hit.headers, formulaCols: new Set() };
  };
  if (hintTitle) {
    try {
      const l = await tryTitle(hintTitle);
      if (l) return l;
    } catch {
      /* fall through to discovery */
    }
  }
  for (const t of await listTabs(spreadsheetId)) {
    const l = await tryTitle(t.title);
    if (l) return l;
  }
  return null;
}

async function lastKnownTitle(workspaceId: string, tabId: TabId): Promise<string | undefined> {
  const [run] = await db
    .select({ summary: sheetSyncRuns.summary })
    .from(sheetSyncRuns)
    .where(and(eq(sheetSyncRuns.workspaceId, workspaceId), eq(sheetSyncRuns.status, "ok")))
    .orderBy(sql`${sheetSyncRuns.startedAt} desc`)
    .limit(1);
  const tabs = (run?.summary as { tabs?: Partial<Record<TabId, { title?: string }>> } | undefined)?.tabs;
  return tabs?.[tabId]?.title;
}

/**
 * Write one row's cells. Each column is judged on its own: a refused column
 * never blocks the others. The mirror row is updated for the cells that
 * landed, so the app reads its own write immediately; the next pull confirms.
 */
export async function writeSheetCells(input: {
  workspaceId: string;
  tab: TabId;
  rowKey: string;
  updates: Record<string, string | number | null>;
  actorId: string | null;
}): Promise<CellWriteResult[]> {
  const { workspaceId, tab, rowKey, updates, actorId } = input;
  const spec = TAB_SPEC_BY_ID[tab];
  const results: CellWriteResult[] = [];
  const log = async (column: string, status: CellWriteStatus, oldValue: string | null, newValue: string | null, detail?: string) => {
    results.push({ column, status, detail });
    await db.insert(sheetCellWrites).values({ workspaceId, tab, rowKey, column, oldValue, newValue, status, detail: detail ?? null, actorId });
  };

  const [mirror] = await db
    .select({ id: sheetRows.id, data: sheetRows.data })
    .from(sheetRows)
    .where(and(eq(sheetRows.workspaceId, workspaceId), eq(sheetRows.tab, tab), eq(sheetRows.rowKey, rowKey)))
    .limit(1);
  const before: SheetRecord = mirror?.data ?? {};

  const candidates: { column: string; value: string | number | null }[] = [];
  for (const [column, value] of Object.entries(updates)) {
    if (!isWritableColumn(spec, column)) {
      await log(column, "refused_readonly", before[column] ?? null, value === null ? null : String(value), "Column is read-only in Internal (derived, or not declared writable).");
      continue;
    }
    candidates.push({ column, value });
  }
  if (!candidates.length) return results;

  if (!isSheetSyncConfigured()) {
    for (const c of candidates) await log(c.column, "pending", before[c.column] ?? null, c.value === null ? null : String(c.value), "Sheet sync is not configured; kept in Internal only.");
    await applyToMirror(workspaceId, tab, rowKey, candidates, mirror?.id);
    return results;
  }

  const spreadsheetId = configuredSheetId();
  try {
    const layout = await locateTab(spreadsheetId, tab, await lastKnownTitle(workspaceId, tab));
    if (!layout) {
      for (const c of candidates) await log(c.column, "failed", before[c.column] ?? null, c.value === null ? null : String(c.value), "Tab not found by its header signature.");
      return results;
    }
    // Find the row by its key columns, read live.
    const keyCols = spec.keyColumns.map((h) => layout.headers.indexOf(h));
    const fallbackCols = (spec.fallbackKeyColumns ?? []).map((h) => layout.headers.indexOf(h));
    const readCol = async (i: number) => (i < 0 ? [] : await readRange(spreadsheetId, `'${layout.title.replace(/'/g, "''")}'!${colRange(i)}`));
    const keyValues = await Promise.all(keyCols.map(readCol));
    const fbValues = await Promise.all(fallbackCols.map(readCol));
    const rowCount = Math.max(0, ...keyValues.map((v) => v.length), ...fbValues.map((v) => v.length));
    let rowIndex0 = -1;
    for (let r = layout.headerRow0 + 1; r < rowCount; r++) {
      const primary = keyValues.map((v) => cellString(v[r]?.[0]).trim());
      const key = primary.some(Boolean) ? primary.join("|") : fbValues.map((v) => cellString(v[r]?.[0]).trim()).join("|");
      if (key === rowKey) {
        rowIndex0 = r;
        break;
      }
    }
    if (rowIndex0 < 0) {
      for (const c of candidates) await log(c.column, "row_not_found", before[c.column] ?? null, c.value === null ? null : String(c.value), "No row with this id in the live sheet.");
      return results;
    }

    const rawWrites: { range: string; value: string | number | null }[] = [];
    const numWrites: { range: string; value: string | number | null }[] = [];
    const landed: { column: string; value: string | number | null }[] = [];
    for (const c of candidates) {
      const col = layout.headers.indexOf(c.column);
      if (col < 0) {
        await log(c.column, "column_absent", before[c.column] ?? null, c.value === null ? null : String(c.value), "The sheet does not have this column yet.");
        continue;
      }
      const range = a1(layout.title, rowIndex0, col);
      if (await cellHasFormula(spreadsheetId, range)) {
        await log(c.column, "refused_formula", before[c.column] ?? null, c.value === null ? null : String(c.value), `${range} carries a formula.`);
        continue;
      }
      (columnSpec(spec, c.column)?.kind === "number" ? numWrites : rawWrites).push({ range, value: c.value });
      landed.push(c);
    }
    await writeCells(spreadsheetId, rawWrites, "RAW");
    await writeCells(spreadsheetId, numWrites, "USER_ENTERED");
    for (const c of landed) await log(c.column, "ok", before[c.column] ?? null, c.value === null ? null : String(c.value));
    await applyToMirror(workspaceId, tab, rowKey, landed, mirror?.id);
  } catch (err) {
    const detail = err instanceof Error ? err.message.slice(0, 500) : String(err);
    for (const c of candidates) if (!results.some((r) => r.column === c.column)) await log(c.column, "pending", before[c.column] ?? null, c.value === null ? null : String(c.value), detail);
    await applyToMirror(workspaceId, tab, rowKey, candidates, mirror?.id);
  }
  invalidate(workspaceId);
  return results;
}

function colRange(i: number): string {
  const letter = a1("x", 0, i).split("!")[1].replace(/\d+$/, "");
  return `${letter}:${letter}`;
}

/** Apply landed (or pending) cell values to the mirror row and re-project the person/company. */
async function applyToMirror(
  workspaceId: string,
  tab: TabId,
  rowKey: string,
  cells: { column: string; value: string | number | null }[],
  mirrorId: string | undefined,
) {
  if (!mirrorId || !cells.length) return;
  const [row] = await db.select({ data: sheetRows.data, personId: sheetRows.personId }).from(sheetRows).where(eq(sheetRows.id, mirrorId)).limit(1);
  if (!row) return;
  const data = { ...row.data };
  for (const c of cells) data[c.column] = c.value === null ? "" : String(c.value);
  await db.update(sheetRows).set({ data, syncedAt: new Date() }).where(eq(sheetRows.id, mirrorId));
  if (tab === "people" || ((tab === "prospect_intelligence" || tab === "deep_dive_dossiers") && row.personId)) {
    const pid = tab === "people" ? rowKey : row.personId!;
    await reprojectPerson(workspaceId, pid);
  }
  if (tab === "companies") {
    const [c] = await db.select({ data: sheetRows.data }).from(sheetRows).where(eq(sheetRows.id, mirrorId)).limit(1);
    if (c) await projectCompanies(workspaceId, [{ key: rowKey, weak: false, record: c.data, hash: "", personId: null, companyId: rowKey }]);
  }
}

/** Re-run the People projection for one person from the mirror. */
export async function reprojectPerson(workspaceId: string, personId: string): Promise<void> {
  const rows = await db
    .select({ tab: sheetRows.tab, key: sheetRows.rowKey, weak: sheetRows.weakKey, data: sheetRows.data, personId: sheetRows.personId, companyId: sheetRows.companyId, hash: sheetRows.rowHash })
    .from(sheetRows)
    .where(and(eq(sheetRows.workspaceId, workspaceId), eq(sheetRows.personId, personId), isNull(sheetRows.deletedAt)));
  const people = rows.filter((r) => r.tab === "people");
  if (!people.length) return;
  const pick = (tab: TabId): ParsedRow[] => rows.filter((r) => r.tab === tab).map((r) => ({ key: r.key, weak: r.weak, record: r.data, hash: r.hash, personId: r.personId, companyId: r.companyId }));
  const companies = await db
    .select({ key: sheetRows.rowKey, data: sheetRows.data })
    .from(sheetRows)
    .where(and(eq(sheetRows.workspaceId, workspaceId), eq(sheetRows.tab, "companies"), isNull(sheetRows.deletedAt), sql`${sheetRows.data}->>'linked_person_ids' like ${"%" + personId + "%"}`));
  await projectPeople(
    workspaceId,
    pick("people"),
    companies.map((c) => ({ key: c.key, weak: false, record: c.data, hash: "", personId: null, companyId: c.key })),
  );
}

/**
 * Mirror Internal-owned outreach state into the masters' optional columns.
 * Silent when the columns do not exist yet (the owner has not added them).
 */
export async function mirrorInternalColumns(
  workspaceId: string,
  target: { tab: "people" | "companies"; rowKey: string },
  state: { outreachStatus?: string; lastContactedAt?: Date | null; owner?: string | null },
  actorId: string | null,
): Promise<void> {
  const updates: Record<string, string | null> = {};
  if (state.outreachStatus !== undefined) updates.outreach_status = state.outreachStatus;
  if (state.lastContactedAt !== undefined) updates.last_contacted_at = state.lastContactedAt ? state.lastContactedAt.toISOString().slice(0, 10) : null;
  // The owner's NAME, not their uuid: the sheet is read by people, and an
  // Internal user id means nothing in it. Internal keeps the id.
  if (state.owner !== undefined) updates.owner = state.owner ?? "";
  if (!Object.keys(updates).length) return;
  try {
    await writeSheetCells({ workspaceId, tab: target.tab, rowKey: target.rowKey, updates, actorId });
  } catch (err) {
    console.error("[sheet-sync] mirrorInternalColumns", err);
  }
}
