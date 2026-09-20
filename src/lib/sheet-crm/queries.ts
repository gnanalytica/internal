import "server-only";

import { and, asc, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/db";
import { contentItems, crmAccounts, crmActivities, crmContacts, interactions, sheetCellWrites, sheetRows, sheetSyncRuns } from "@/db/schema";
import { wsTags } from "@/lib/cache-tags";
import type { CrmAccount, CrmContact, Member } from "@/lib/types";
import type { TabId } from "./mapping";
import { matchesExclusion, parseExclusions, SHEET_SOURCE, type ExclusionEntry, type SheetRecord } from "./projection";

/**
 * Reads for the Prospects workspace. Every read is workspace-scoped and
 * cached under the `sheet` / `crm` / `interactions` tags that the sync and
 * the actions invalidate.
 */

export type SheetRow = {
  id: string;
  tab: TabId;
  rowKey: string;
  weakKey: boolean;
  personId: string | null;
  companyId: string | null;
  data: SheetRecord;
  syncedAt: Date;
};

const rowCols = {
  id: sheetRows.id,
  tab: sheetRows.tab,
  rowKey: sheetRows.rowKey,
  weakKey: sheetRows.weakKey,
  personId: sheetRows.personId,
  companyId: sheetRows.companyId,
  data: sheetRows.data,
  syncedAt: sheetRows.syncedAt,
};

const asRows = (rows: { tab: string; [k: string]: unknown }[]) => rows as unknown as SheetRow[];

export async function getSheetTabRows(workspaceId: string, tab: TabId): Promise<SheetRow[]> {
  "use cache";
  cacheTag(...wsTags(workspaceId, "sheet"));
  cacheLife("minutes");
  const rows = await db
    .select(rowCols)
    .from(sheetRows)
    .where(and(eq(sheetRows.workspaceId, workspaceId), eq(sheetRows.tab, tab), isNull(sheetRows.deletedAt)))
    .orderBy(asc(sheetRows.rowKey));
  return asRows(rows);
}

export type SheetSyncRun = {
  id: string;
  trigger: string;
  startedAt: Date;
  finishedAt: Date | null;
  status: string;
  summary: Record<string, unknown>;
  error: string | null;
};

export async function getSheetSyncRuns(workspaceId: string, limit = 10): Promise<SheetSyncRun[]> {
  "use cache";
  cacheTag(...wsTags(workspaceId, "sheet"));
  cacheLife("minutes");
  return db
    .select({
      id: sheetSyncRuns.id,
      trigger: sheetSyncRuns.trigger,
      startedAt: sheetSyncRuns.startedAt,
      finishedAt: sheetSyncRuns.finishedAt,
      status: sheetSyncRuns.status,
      summary: sheetSyncRuns.summary,
      error: sheetSyncRuns.error,
    })
    .from(sheetSyncRuns)
    .where(eq(sheetSyncRuns.workspaceId, workspaceId))
    .orderBy(desc(sheetSyncRuns.startedAt))
    .limit(limit);
}

export type CellWrite = typeof sheetCellWrites.$inferSelect;

export async function getRecentCellWrites(workspaceId: string, limit = 50): Promise<CellWrite[]> {
  "use cache";
  cacheTag(...wsTags(workspaceId, "sheet"));
  cacheLife("minutes");
  return db
    .select()
    .from(sheetCellWrites)
    .where(eq(sheetCellWrites.workspaceId, workspaceId))
    .orderBy(desc(sheetCellWrites.writtenAt))
    .limit(limit);
}

export async function getExclusions(workspaceId: string): Promise<ExclusionEntry[]> {
  "use cache";
  cacheTag(...wsTags(workspaceId, "sheet"));
  cacheLife("minutes");
  const rows = await getSheetTabRows(workspaceId, "exclusions");
  return parseExclusions(rows.map((r) => r.data));
}

// ---- People (prospects) ----

export type ProspectRow = CrmContact & { account: CrmAccount | null; excluded: ExclusionEntry | null };

export type PeopleFilter = {
  q?: string;
  state?: string;
  city?: string;
  priority?: string;
  band?: string;
  status?: string;
  persona?: "valuer" | "institutional";
  hasPhone?: boolean;
  hasEmail?: boolean;
  rvo?: string;
  /** Only rows with research (a Prospect Intelligence row). */
  researched?: boolean;
  /** Hide rows the sheet itself flagged as duplicates of another row. */
  hideDuplicates?: boolean;
  limit?: number;
  offset?: number;
};

/**
 * Server-side list of sheet-sourced contacts. Search covers name, id, IBBI,
 * email, phone, city and firm; everything else is an exact filter. Bounded.
 */
export async function getProspects(workspaceId: string, f: PeopleFilter = {}): Promise<{ rows: ProspectRow[]; total: number }> {
  "use cache";
  cacheTag(...wsTags(workspaceId, "crm", "sheet"));
  cacheLife("minutes");
  const where: SQL[] = [eq(crmContacts.workspaceId, workspaceId), eq(crmContacts.externalSource, SHEET_SOURCE)];
  if (f.q?.trim()) {
    const like = `%${f.q.trim()}%`;
    where.push(
      or(
        ilike(crmContacts.name, like),
        ilike(crmContacts.externalId, like),
        ilike(crmContacts.ibbiRegNo, like),
        ilike(crmContacts.email, like),
        ilike(crmContacts.phone, like),
        ilike(crmContacts.city, like),
        ilike(crmContacts.title, like),
      )!,
    );
  }
  if (f.state) where.push(eq(crmContacts.state, f.state));
  if (f.city) where.push(ilike(crmContacts.city, `%${f.city}%`));
  if (f.priority) where.push(eq(crmContacts.priority, f.priority));
  if (f.band) where.push(eq(crmContacts.scoreBand, f.band));
  if (f.status) where.push(eq(crmContacts.outreachStatus, f.status));
  if (f.rvo) where.push(ilike(crmContacts.rvo, `%${f.rvo}%`));
  if (f.persona === "institutional") where.push(eq(crmContacts.persona, "institutional"));
  if (f.persona === "valuer") where.push(sql`${crmContacts.persona} is distinct from 'institutional'`);
  if (f.hasPhone) where.push(sql`${crmContacts.phoneE164} is not null`);
  if (f.hasEmail) where.push(sql`${crmContacts.email} is not null and ${crmContacts.email} <> ''`);
  if (f.researched) where.push(sql`${crmContacts.priority} is not null`);
  if (f.hideDuplicates) where.push(eq(crmContacts.sheetDuplicate, false));
  const cond = and(...where);
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(crmContacts).where(cond);
  const rows = await db.query.crmContacts.findMany({
    where: cond,
    with: { account: true },
    // Scored first, then priority A→D, then hotter lead_score, then name.
    orderBy: [
      sql`${crmContacts.opportunityScore} desc nulls last`,
      sql`${crmContacts.priority} asc nulls last`,
      sql`${crmContacts.leadScore} desc nulls last`,
      asc(crmContacts.name),
    ],
    limit: Math.min(f.limit ?? 100, 500),
    offset: f.offset ?? 0,
  });
  const exclusions = await getExclusions(workspaceId);
  return { rows: rows.map((r) => ({ ...r, excluded: matchesExclusion(r.name, exclusions) })), total };
}

/** Distinct filter values, for the toolbar. */
export async function getProspectFacets(workspaceId: string): Promise<{ states: string[]; rvos: string[]; priorities: string[]; bands: string[] }> {
  "use cache";
  cacheTag(...wsTags(workspaceId, "crm"));
  cacheLife("minutes");
  const base = and(eq(crmContacts.workspaceId, workspaceId), eq(crmContacts.externalSource, SHEET_SOURCE));
  const distinct = async (col: AnyPgColumn) =>
    (await db.selectDistinct({ v: sql<string | null>`${col}` }).from(crmContacts).where(and(base, sql`${col} is not null`)).orderBy(asc(col))).map((r) => r.v!).filter(Boolean);
  return {
    states: await distinct(crmContacts.state),
    rvos: await distinct(crmContacts.rvo),
    priorities: await distinct(crmContacts.priority),
    bands: await distinct(crmContacts.scoreBand),
  };
}

export type ProspectStats = {
  people: number;
  institutional: number;
  researched: number;
  scored: number;
  byStatus: Record<string, number>;
  withPhone: number;
  withEmail: number;
  /** Rows the sheet flagged DUPLICATE. Shown, never hidden, unless filtered. */
  duplicates: number;
};

export async function getProspectStats(workspaceId: string): Promise<ProspectStats> {
  "use cache";
  cacheTag(...wsTags(workspaceId, "crm"));
  cacheLife("minutes");
  const base = and(eq(crmContacts.workspaceId, workspaceId), eq(crmContacts.externalSource, SHEET_SOURCE));
  const [agg] = await db
    .select({
      people: sql<number>`count(*)::int`,
      institutional: sql<number>`count(*) filter (where ${crmContacts.persona} = 'institutional')::int`,
      researched: sql<number>`count(*) filter (where ${crmContacts.priority} is not null)::int`,
      scored: sql<number>`count(*) filter (where ${crmContacts.opportunityScore} is not null)::int`,
      withPhone: sql<number>`count(*) filter (where ${crmContacts.phoneE164} is not null)::int`,
      withEmail: sql<number>`count(*) filter (where ${crmContacts.email} is not null and ${crmContacts.email} <> '')::int`,
      duplicates: sql<number>`count(*) filter (where ${crmContacts.sheetDuplicate})::int`,
    })
    .from(crmContacts)
    .where(base);
  const statuses = await db
    .select({ status: crmContacts.outreachStatus, n: sql<number>`count(*)::int` })
    .from(crmContacts)
    .where(base)
    .groupBy(crmContacts.outreachStatus);
  return { ...agg, byStatus: Object.fromEntries(statuses.map((s) => [s.status, s.n])) };
}

export type Interaction = typeof interactions.$inferSelect & { actor: Member | null };

export async function getInteractions(
  workspaceId: string,
  scope: { contactId?: string; accountId?: string },
  limit = 200,
): Promise<Interaction[]> {
  "use cache";
  cacheTag(...wsTags(workspaceId, "interactions"));
  cacheLife("minutes");
  const where = scope.contactId
    ? and(eq(interactions.workspaceId, workspaceId), eq(interactions.contactId, scope.contactId))
    : scope.accountId
      ? and(eq(interactions.workspaceId, workspaceId), eq(interactions.accountId, scope.accountId))
      : eq(interactions.workspaceId, workspaceId);
  return db.query.interactions.findMany({ where, with: { actor: true }, orderBy: [desc(interactions.occurredAt)], limit });
}

export type PersonView = {
  contact: CrmContact & { account: CrmAccount | null; owner: Member | null };
  people: SheetRecord | null;
  prospect: SheetRow | null;
  dossier: SheetRow | null;
  queue: SheetRow | null;
  iov: SheetRecord[];
  referrals: SheetRecord[];
  lenderContacts: SheetRecord[];
  company: { account: CrmAccount; record: SheetRecord | null } | null;
  colleagues: { id: string; name: string; externalId: string | null }[];
  excluded: ExclusionEntry | null;
  interactions: Interaction[];
  activities: (typeof crmActivities.$inferSelect & { actor: Member | null })[];
  writes: CellWrite[];
};

/** Resolve a contact by uuid or by its sheet person_id (P#####). */
export async function resolveContactId(workspaceId: string, idOrPersonId: string): Promise<string | null> {
  "use cache";
  cacheTag(...wsTags(workspaceId, "crm"));
  cacheLife("minutes");
  const byPid = /^P\d{5}$/i.test(idOrPersonId);
  const [row] = await db
    .select({ id: crmContacts.id })
    .from(crmContacts)
    .where(
      and(
        eq(crmContacts.workspaceId, workspaceId),
        byPid ? and(eq(crmContacts.externalSource, SHEET_SOURCE), eq(crmContacts.externalId, idOrPersonId.toUpperCase())) : eq(crmContacts.id, idOrPersonId),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

export async function getPersonView(workspaceId: string, contactId: string): Promise<PersonView | null> {
  "use cache";
  cacheTag(...wsTags(workspaceId, "crm", "sheet", "interactions"));
  cacheLife("minutes");
  const contact = await db.query.crmContacts.findFirst({
    where: and(eq(crmContacts.workspaceId, workspaceId), eq(crmContacts.id, contactId)),
    with: { account: true, owner: true },
  });
  if (!contact) return null;
  const pid = contact.externalSource === SHEET_SOURCE ? contact.externalId : null;
  const rows = pid
    ? asRows(
        await db
          .select(rowCols)
          .from(sheetRows)
          .where(and(eq(sheetRows.workspaceId, workspaceId), eq(sheetRows.personId, pid), isNull(sheetRows.deletedAt))),
      )
    : [];
  const one = (tab: TabId) => rows.find((r) => r.tab === tab) ?? null;
  const people = one("people")?.data ?? null;

  // Referral Map names people in free text; Lender Contacts is matched by the
  // bank names in the person's verified relationships.
  const referralRows = await getSheetTabRows(workspaceId, "referral_map");
  const nameKey = contact.name.toLowerCase();
  const referrals = referralRows
    .map((r) => r.data)
    .filter((d) => (d["Relevant Prospects"] ?? "").toLowerCase().includes(nameKey) || (pid ? (d["Relevant Prospects"] ?? "").includes(pid) : false));

  const prospect = one("prospect_intelligence");
  const banks = (prospect?.data["Verified Current Bank / Lender Relationships"] ?? people?.empanelled_with ?? "")
    .split(/[;,]/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 3);
  const lenderRows = banks.length ? await getSheetTabRows(workspaceId, "lender_contacts") : [];
  const lenderContacts = lenderRows
    .map((r) => r.data)
    .filter((d) => {
      const inst = (d.institution ?? "").toLowerCase();
      return banks.some((b) => inst && (b.includes(inst) || inst.includes(b.split(" ")[0] ?? "\u0000")));
    })
    .slice(0, 12);

  let company: PersonView["company"] = null;
  let colleagues: PersonView["colleagues"] = [];
  if (contact.account) {
    const cid = contact.account.externalSource === SHEET_SOURCE ? contact.account.externalId : null;
    const [crow] = cid
      ? await db
          .select({ data: sheetRows.data })
          .from(sheetRows)
          .where(and(eq(sheetRows.workspaceId, workspaceId), eq(sheetRows.tab, "companies"), eq(sheetRows.rowKey, cid), isNull(sheetRows.deletedAt)))
          .limit(1)
      : [];
    company = { account: contact.account, record: crow?.data ?? null };
    colleagues = await db
      .select({ id: crmContacts.id, name: crmContacts.name, externalId: crmContacts.externalId })
      .from(crmContacts)
      .where(and(eq(crmContacts.workspaceId, workspaceId), eq(crmContacts.accountId, contact.account.id), sql`${crmContacts.id} <> ${contact.id}`))
      .orderBy(asc(crmContacts.name))
      .limit(30);
  }

  const [exclusions, ints, acts, writes] = await Promise.all([
    getExclusions(workspaceId),
    getInteractions(workspaceId, { contactId }),
    db.query.crmActivities.findMany({ where: eq(crmActivities.contactId, contactId), with: { actor: true }, orderBy: [desc(crmActivities.createdAt)], limit: 100 }),
    pid
      ? db
          .select()
          .from(sheetCellWrites)
          .where(and(eq(sheetCellWrites.workspaceId, workspaceId), or(eq(sheetCellWrites.rowKey, pid), eq(sheetCellWrites.rowKey, contact.name))!))
          .orderBy(desc(sheetCellWrites.writtenAt))
          .limit(30)
      : Promise.resolve([] as CellWrite[]),
  ]);

  return {
    contact,
    people,
    prospect,
    dossier: one("deep_dive_dossiers"),
    queue: one("research_queue"),
    iov: rows.filter((r) => r.tab === "iov_memberships").map((r) => r.data),
    referrals,
    lenderContacts,
    company,
    colleagues,
    excluded: matchesExclusion(contact.name, exclusions),
    interactions: ints,
    activities: acts,
    writes,
  };
}

export type CompanyView = {
  account: CrmAccount & { owner: Member | null };
  record: SheetRecord | null;
  people: { id: string; name: string; externalId: string | null; priority: string | null; outreachStatus: string; phone: string | null; email: string | null }[];
  excluded: ExclusionEntry | null;
  interactions: Interaction[];
  activities: (typeof crmActivities.$inferSelect & { actor: Member | null })[];
};

export async function getCompanyView(workspaceId: string, accountId: string): Promise<CompanyView | null> {
  "use cache";
  cacheTag(...wsTags(workspaceId, "crm", "sheet", "interactions"));
  cacheLife("minutes");
  const account = await db.query.crmAccounts.findFirst({
    where: and(eq(crmAccounts.workspaceId, workspaceId), eq(crmAccounts.id, accountId)),
    with: { owner: true },
  });
  if (!account) return null;
  const cid = account.externalSource === SHEET_SOURCE ? account.externalId : null;
  const [row] = cid
    ? await db
        .select({ data: sheetRows.data })
        .from(sheetRows)
        .where(and(eq(sheetRows.workspaceId, workspaceId), eq(sheetRows.tab, "companies"), eq(sheetRows.rowKey, cid), isNull(sheetRows.deletedAt)))
        .limit(1)
    : [];
  const [people, exclusions, ints, acts] = await Promise.all([
    db
      .select({ id: crmContacts.id, name: crmContacts.name, externalId: crmContacts.externalId, priority: crmContacts.priority, outreachStatus: crmContacts.outreachStatus, phone: crmContacts.phone, email: crmContacts.email })
      .from(crmContacts)
      .where(and(eq(crmContacts.workspaceId, workspaceId), eq(crmContacts.accountId, accountId)))
      .orderBy(asc(crmContacts.name))
      .limit(100),
    getExclusions(workspaceId),
    getInteractions(workspaceId, { accountId }),
    db.query.crmActivities.findMany({ where: eq(crmActivities.accountId, accountId), with: { actor: true }, orderBy: [desc(crmActivities.createdAt)], limit: 100 }),
  ]);
  return { account, record: row?.data ?? null, people, excluded: matchesExclusion(account.name, exclusions), interactions: ints, activities: acts };
}

// ---- Research queue: sheet rows + the contact they resolve to ----

export type QueueItem = SheetRow & { contactId: string | null; outreachStatus: string | null };

export async function getResearchQueue(workspaceId: string): Promise<QueueItem[]> {
  "use cache";
  cacheTag(...wsTags(workspaceId, "sheet", "crm"));
  cacheLife("minutes");
  const rows = await getSheetTabRows(workspaceId, "research_queue");
  const pids = rows.map((r) => r.personId).filter((p): p is string => Boolean(p));
  const contacts = pids.length
    ? await db
        .select({ id: crmContacts.id, externalId: crmContacts.externalId, outreachStatus: crmContacts.outreachStatus })
        .from(crmContacts)
        .where(and(eq(crmContacts.workspaceId, workspaceId), eq(crmContacts.externalSource, SHEET_SOURCE), inArray(crmContacts.externalId, pids)))
    : [];
  const byPid = new Map(contacts.map((c) => [c.externalId!, c]));
  const order = (r: SheetRow) => {
    const n = Number(r.data["Target Completion Order"]);
    return Number.isFinite(n) ? n : 9999;
  };
  return rows
    .map((r) => ({ ...r, contactId: r.personId ? (byPid.get(r.personId)?.id ?? null) : null, outreachStatus: r.personId ? (byPid.get(r.personId)?.outreachStatus ?? null) : null }))
    .sort((a, b) => order(a) - order(b) || a.data.Priority.localeCompare(b.data.Priority));
}

// ---- Data quality ----

export type QualityIssue = { kind: string; title: string; detail: string; tab: TabId; rowKey: string; personId?: string | null };

/**
 * The findings from the 2026-09-20 analysis, computed live over the mirror
 * and bounded. Internal lists them; it never fixes the sheet on its own.
 */
export async function getDataQualityIssues(workspaceId: string): Promise<{ issues: QualityIssue[]; counts: Record<string, number> }> {
  "use cache";
  cacheTag(...wsTags(workspaceId, "sheet"));
  cacheLife("minutes");
  const issues: QualityIssue[] = [];
  const counts: Record<string, number> = {};
  const push = (i: QualityIssue) => {
    counts[i.kind] = (counts[i.kind] ?? 0) + 1;
    if (issues.length < 400) issues.push(i);
  };
  const live = and(eq(sheetRows.workspaceId, workspaceId), isNull(sheetRows.deletedAt));

  // 1. People sharing an IBBI number, a primary email or a phone.
  for (const [kind, expr, label] of [
    ["dup_ibbi", sql`nullif(trim(${sheetRows.data}->>'ibbi_reg_no'), '')`, "Same IBBI number"],
    ["dup_email", sql`nullif(lower(split_part(${sheetRows.data}->>'email', ';', 1)), '')`, "Same email"],
    ["dup_phone", sql`nullif(regexp_replace(${sheetRows.data}->>'phone', '\\D', '', 'g'), '')`, "Same phone"],
  ] as const) {
    const dups = await db
      .select({ v: sql<string>`${expr}`, keys: sql<string[]>`array_agg(${sheetRows.rowKey} order by ${sheetRows.rowKey})` })
      .from(sheetRows)
      .where(and(live, eq(sheetRows.tab, "people")))
      .groupBy(sql`${expr}`)
      .having(sql`${expr} is not null and count(*) > 1`)
      .limit(100);
    for (const d of dups) push({ kind, title: label, detail: `${d.v}: ${d.keys.join(", ")}`, tab: "people", rowKey: d.keys[0], personId: d.keys[0] });
  }

  // 2. The sheet's own duplicate_flag, which nothing in the sheet acts on.
  const flagged = await db
    .select({ rowKey: sheetRows.rowKey, name: sql<string>`${sheetRows.data}->>'full_name'`, match: sql<string>`${sheetRows.data}->>'duplicate_match_ids'` })
    .from(sheetRows)
    .where(and(live, eq(sheetRows.tab, "people"), sql`upper(coalesce(${sheetRows.data}->>'duplicate_flag','')) = 'DUPLICATE'`))
    .limit(300);
  for (const f of flagged)
    push({ kind: "flagged_duplicate", title: "Flagged DUPLICATE in the sheet, not merged", detail: `${f.rowKey} ${f.name}${f.match ? ` — ${f.match.slice(0, 60)}` : ""}`, tab: "people", rowKey: f.rowKey, personId: f.rowKey });

  // 3. duplicate_match_ids that is not an id.
  const badMatch = await db
    .select({ rowKey: sheetRows.rowKey, v: sql<string>`${sheetRows.data}->>'duplicate_match_ids'` })
    .from(sheetRows)
    .where(and(live, inArray(sheetRows.tab, ["people", "companies"]), sql`nullif(${sheetRows.data}->>'duplicate_match_ids','') is not null and ${sheetRows.data}->>'duplicate_match_ids' !~ '^[PC][0-9]{4,5}'`))
    .limit(50);
  for (const b of badMatch) push({ kind: "match_ids_text", title: "duplicate_match_ids holds text, not an id", detail: `${b.rowKey}: ${b.v.slice(0, 80)}`, tab: b.rowKey.startsWith("C") ? "companies" : "people", rowKey: b.rowKey, personId: b.rowKey.startsWith("P") ? b.rowKey : null });

  // 3. Blank city with an address present.
  const blankCity = await db
    .select({ rowKey: sheetRows.rowKey, addr: sql<string>`${sheetRows.data}->>'address'` })
    .from(sheetRows)
    .where(and(live, eq(sheetRows.tab, "people"), sql`coalesce(${sheetRows.data}->>'city','') = '' and coalesce(${sheetRows.data}->>'address','') <> ''`))
    .limit(100);
  for (const b of blankCity) push({ kind: "blank_city", title: "city blank, address present", detail: `${b.rowKey}: ${b.addr.slice(0, 80)}`, tab: "people", rowKey: b.rowKey, personId: b.rowKey });

  // 4. GTM rows keyed by name (no person_id).
  const weak = await db
    .select({ tab: sheetRows.tab, rowKey: sheetRows.rowKey })
    .from(sheetRows)
    .where(and(live, eq(sheetRows.weakKey, true)))
    .limit(200);
  for (const w of weak)
    if (w.tab !== "lender_contacts" && w.tab !== "association_officers")
      push({ kind: "unlinked", title: "Row has no person_id", detail: `${w.tab}: ${w.rowKey}`, tab: w.tab as TabId, rowKey: w.rowKey });

  // 5. Non-lender tokens in empanelled_with (inflates lead_score).
  const junk = await db
    .select({ rowKey: sheetRows.rowKey, v: sql<string>`${sheetRows.data}->>'empanelled_with'` })
    .from(sheetRows)
    .where(and(live, eq(sheetRows.tab, "people"), sql`${sheetRows.data}->>'empanelled_with' ~* '(input record|does not list|none found|published on site)'`))
    .limit(50);
  for (const j of junk) push({ kind: "empanelment_text", title: "empanelled_with carries prose (counted as a panel)", detail: `${j.rowKey}: ${j.v.slice(0, 80)}`, tab: "people", rowKey: j.rowKey, personId: j.rowKey });

  // 6. Prospects that match the Exclusions tab.
  const exclusions = await getExclusions(workspaceId);
  if (exclusions.length) {
    const prospects = await db
      .select({ id: crmContacts.id, name: crmContacts.name, externalId: crmContacts.externalId })
      .from(crmContacts)
      .where(and(eq(crmContacts.workspaceId, workspaceId), eq(crmContacts.externalSource, SHEET_SOURCE), sql`${crmContacts.priority} is not null`));
    for (const p of prospects) {
      const hit = matchesExclusion(p.name, exclusions);
      if (hit) push({ kind: "excluded_prospect", title: "Researched prospect is on the Exclusions tab", detail: `${p.name} matches "${hit.name}"`, tab: "prospect_intelligence", rowKey: p.externalId ?? p.name, personId: p.externalId });
    }
  }

  // 7. Rows that vanished from the sheet since a previous sync.
  const [gone] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(sheetRows)
    .where(and(eq(sheetRows.workspaceId, workspaceId), sql`${sheetRows.deletedAt} is not null`));
  if (gone.n) counts.removed_rows = gone.n;

  return { issues, counts };
}

// ---- Marketing: dossier content assets ↔ content library, campaign outcomes ----

export type ContentAssetRow = {
  asset: string;
  people: { id: string; name: string; personId: string | null }[];
  match: { id: string; title: string; url: string | null; status: string } | null;
};

const assetKey = (s: string) => s.toLowerCase().replace(/^\s*\d+\s*-?\s*(second|sec)\s*(video)?:?\s*/i, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Every "Content Asset To Share" the dossiers name, who it is for, and the
 * content-calendar item it resolves to (by title containment either way).
 * Unresolved assets are the marketing backlog the sheet already implies.
 */
export async function getContentAssets(workspaceId: string): Promise<ContentAssetRow[]> {
  "use cache";
  cacheTag(...wsTags(workspaceId, "sheet", "campaigns", "crm"));
  cacheLife("minutes");
  const [dossiers, items] = await Promise.all([
    getSheetTabRows(workspaceId, "deep_dive_dossiers"),
    db.select({ id: contentItems.id, title: contentItems.title, url: contentItems.url, status: contentItems.status }).from(contentItems).where(eq(contentItems.workspaceId, workspaceId)),
  ]);
  const pids = dossiers.map((d) => d.personId).filter((p): p is string => Boolean(p));
  const contacts = pids.length
    ? await db.select({ id: crmContacts.id, name: crmContacts.name, externalId: crmContacts.externalId }).from(crmContacts).where(and(eq(crmContacts.workspaceId, workspaceId), eq(crmContacts.externalSource, SHEET_SOURCE), inArray(crmContacts.externalId, pids)))
    : [];
  const byPid = new Map(contacts.map((c) => [c.externalId!, c]));
  const groups = new Map<string, ContentAssetRow>();
  for (const d of dossiers) {
    const raw = (d.data["Content Asset To Share"] ?? "").trim();
    if (!raw) continue;
    for (const part of raw.split(/\n|;/).map((s) => s.trim()).filter(Boolean)) {
      const key = assetKey(part);
      if (!key) continue;
      let g = groups.get(key);
      if (!g) {
        const m = items.find((it) => {
          const t = assetKey(it.title);
          return t.length > 8 && (key.includes(t) || t.includes(key));
        });
        g = { asset: part, people: [], match: m ? { id: m.id, title: m.title, url: m.url, status: m.status } : null };
        groups.set(key, g);
      }
      const c = d.personId ? byPid.get(d.personId) : undefined;
      const person = c ? { id: c.id, name: c.name, personId: c.externalId } : { id: "", name: d.data.Name ?? d.rowKey, personId: d.personId };
      if (!g.people.some((p) => p.name === person.name)) g.people.push(person);
    }
  }
  return [...groups.values()].sort((a, b) => Number(Boolean(a.match)) - Number(Boolean(b.match)) || b.people.length - a.people.length);
}

export type CampaignOutcome = { sent: number; replies: number; meetings: number; people: number };

/** Reach / replies / meetings per campaign, computed from logged interactions rather than typed in. */
export async function getCampaignOutcomes(workspaceId: string): Promise<Record<string, CampaignOutcome>> {
  "use cache";
  cacheTag(...wsTags(workspaceId, "interactions"));
  cacheLife("minutes");
  const rows = await db
    .select({
      campaignId: interactions.campaignId,
      sent: sql<number>`count(*) filter (where ${interactions.direction} = 'out')::int`,
      replies: sql<number>`count(*) filter (where ${interactions.direction} = 'in')::int`,
      meetings: sql<number>`count(*) filter (where ${interactions.channel} = 'meeting')::int`,
      people: sql<number>`count(distinct ${interactions.contactId})::int`,
    })
    .from(interactions)
    .where(and(eq(interactions.workspaceId, workspaceId), sql`${interactions.campaignId} is not null`))
    .groupBy(interactions.campaignId);
  return Object.fromEntries(rows.map((r) => [r.campaignId!, { sent: r.sent, replies: r.replies, meetings: r.meetings, people: r.people }]));
}
