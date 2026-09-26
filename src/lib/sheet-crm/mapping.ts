/**
 * The Valytica lead CRM workbook, as Internal understands it.
 *
 * This is the ONLY file that spells a tab's header strings. Every header here
 * is quoted exactly as the workbook prints it (case, spacing, slashes), and
 * `mapping.test.ts` asserts the fixture header rows match, so a renamed column
 * fails `pnpm test` instead of silently syncing nothing.
 *
 * Tabs are identified by their HEADER ROW, not by their tab name: the sync
 * scans the first rows of every sheet for one that carries a spec's
 * `signature` headers. A renamed tab keeps syncing; a tab whose signature has
 * gone is reported as drift.
 *
 * Nothing in this file creates, renames or moves anything in the workbook.
 */

export type CellKind = "text" | "number" | "date";

export type ColumnSpec = {
  header: string;
  /** Internal may write this cell (write-through from an edit in the app). */
  writable?: boolean;
  /** Formula / derived in the sheet: never written, whatever `writable` says. */
  derived?: boolean;
  /** How a write is typed. Defaults to text (RAW), which keeps leading zeros. */
  kind?: CellKind;
  /** Column added at Internal's request; may be absent until the owner adds it. */
  optional?: boolean;
};

export type TabSpec = {
  /** Stable id used as `sheet_rows.tab`. Never the display name. */
  id: TabId;
  /** Best-known tab title, for diagnostics and cell links only. */
  expectedTitle: string;
  /** Headers that must all be present on one row for the row to be the header. */
  signature: string[];
  columns: ColumnSpec[];
  /** Columns whose values, joined with `|`, form the row key. */
  keyColumns: string[];
  /** Fallback key columns when every `keyColumns` cell is blank. */
  fallbackKeyColumns?: string[];
  /** Header rows that come before the real header (title banners). */
  bannerRows?: number;
  /** Person-id column, when the tab carries one (FK to People). */
  personIdColumn?: string;
  /** Company-id column, when the tab carries one. */
  companyIdColumn?: string;
  /**
   * Declared, but the tab does not exist in the workbook yet.
   *
   * `mapping.test.ts` checks every spec against a fixture captured FROM the
   * live sheet, which a tab that has not been built cannot have. Certifying a
   * pending spec against a fixture generated from the spec itself would make
   * that test agree with whatever was declared, which is the one thing it
   * exists to prevent.
   */
  pending?: true;
};

export const TAB_IDS = [
  "people",
  "companies",
  "rvos",
  "lender_landscape",
  "lender_contacts",
  "association_officers",
  "iov_memberships",
  "source_inventory",
  "prospect_intelligence",
  "referral_map",
  "research_queue",
  "gtm_personas",
  "deep_dive_dossiers",
  "prospect_research",
  "exclusions",
] as const;

export type TabId = (typeof TAB_IDS)[number];

const col = (header: string, o: Omit<ColumnSpec, "header"> = {}): ColumnSpec => ({ header, ...o });
const w = (header: string, kind?: CellKind): ColumnSpec => ({ header, writable: true, kind });
const d = (header: string): ColumnSpec => ({ header, derived: true });


/**
 * Columns Internal owns and mirrors into the masters (added at our request).
 *
 * Each is `optional`, so none of them has to exist: until the sheet's owner
 * adds the header, a write to it is refused as `column_absent` and kept as a
 * pending write — the value still lives in Internal, and starts appearing in
 * the sheet the day the column does. Adding a column to the workbook is the
 * sheet owner's decision, never ours.
 */
export const INTERNAL_OWNED_COLUMNS = ["outreach_status", "last_contacted_at", "owner"] as const;

export const PEOPLE: TabSpec = {
  id: "people",
  expectedTitle: "People",
  // `canonical_entity_key` was a signature header until 2026-09-26. A signature
  // entry must outlive every column cleanup, and that one was scratch space for
  // a duplicate check nothing consumed.
  signature: ["person_id", "full_name", "ibbi_reg_no", "lead_score"],
  keyColumns: ["person_id"],
  personIdColumn: "person_id",
  columns: [
    col("person_id"),
    col("full_name"),
    col("ibbi_reg_no"),
    col("ibbi_reg_date"),
    col("rvo"),
    w("email"),
    w("phone"),
    col("address"),
    w("city"),
    col("state"),
    w("pincode"),
    d("is_south_india"),
    col("company_names"),
    col("company_ibbi_reg_nos"),
    col("company_link_source"),
    col("empanelled_with"),
    d("num_empanelments"),
    d("lead_score"),
    col("pnb_zone"),
    col("pnb_category"),
    col("pnb_constitution"),
    col("other_asset_classes"),
    col("sources"),
    d("source_count"),
    w("remarks"),
    w("website"),
    w("linkedin"),
    col("firm_size"),
    col("years_practice"),
    w("specialisation"),
    col("associations_and_roles"),
    col("iov_membership_no"),
    col("iov_asset_class"),
    col("iov_approved_valuer"),
    col("iov_match_confidence"),
    w("current_tooling_signal"),
    w("sales_angle"),
    w("research_confidence"),
    col("enrichment_sources"),
    col("data_quality_flag"),
    d("duplicate_flag"),
    // Folded off Prospect Intelligence / Deep Dive Dossiers / Research Queue on
    // 2026-09-26 so a person's research state lives on the person. Writable:
    // these are edited by a researcher and by the hourly writer, unlike the
    // derived columns above.
    w("research_status"),
    w("priority"),
    w("opportunity_score", "number"),
    w("score_band"),
    w("persona"),
    w("best_first_channel"),
    w("next_action"),
    w("why_now"),
    w("pain"),
    w("is_institutional"),
    col("outreach_status", { writable: true, optional: true }),
    col("last_contacted_at", { writable: true, optional: true, kind: "date" }),
    col("owner", { writable: true, optional: true }),
  ],
};

export const COMPANIES: TabSpec = {
  id: "companies",
  expectedTitle: "Companies",
  signature: ["company_id", "company_name", "linked_person_ids"],
  keyColumns: ["company_id"],
  companyIdColumn: "company_id",
  columns: [
    col("company_id"),
    col("company_name"),
    col("constitution"),
    col("ibbi_entity_reg_no"),
    col("asset_classes"),
    col("ibbi_reg_date"),
    col("rvo"),
    w("email"),
    w("phone"),
    w("website"),
    col("address"),
    w("city"),
    col("state"),
    col("pincode"),
    d("is_south_india"),
    col("key_people"),
    col("key_people_ibbi_reg_nos"),
    col("linked_person_ids"),
    d("num_linked_people"),
    col("empanelled_with"),
    col("pnb_zone"),
    col("pnb_category"),
    col("sources"),
    w("remarks"),
    w("linkedin"),
    col("num_valuers"),
    col("branch_offices"),
    col("service_lines"),
    w("decision_makers"),
    w("decision_maker_contacts"),
    col("volume_signal"),
    w("current_tooling_signal"),
    w("sales_angle"),
    w("research_confidence"),
    col("enrichment_sources"),
    col("outreach_status", { writable: true, optional: true }),
    col("last_contacted_at", { writable: true, optional: true, kind: "date" }),
    col("owner", { writable: true, optional: true }),
  ],
};

export const RVOS: TabSpec = {
  id: "rvos",
  expectedTitle: "RVOs",
  signature: ["rvo_name", "acronym", "parent_body", "lb_valuer_count"],
  keyColumns: ["rvo_name"],
  columns: [
    "rvo_name", "acronym", "parent_body", "address", "phone", "email", "website",
    "key_people", "asset_classes", "lb_valuer_count", "outreach_channels", "approach_notes",
  ].map((h) => col(h)),
};

export const LENDER_LANDSCAPE: TabSpec = {
  id: "lender_landscape",
  expectedTitle: "Lender Landscape",
  signature: ["institution", "institution_type", "relevance_to_valytica"],
  keyColumns: ["institution"],
  bannerRows: 1,
  columns: ["institution", "institution_type", "relevance_to_valytica", "notes"].map((h) => col(h)),
};

export const LENDER_CONTACTS: TabSpec = {
  id: "lender_contacts",
  expectedTitle: "Lender Contacts",
  signature: ["institution", "office_level", "contact_person_name", "empanelment_open_window"],
  keyColumns: ["lender_contact_id"],
  fallbackKeyColumns: ["institution", "office_level", "department", "contact_person_name"],
  bannerRows: 1,
  columns: [
    col("lender_contact_id", { optional: true }),
    col("institution"),
    col("institution_type"),
    col("office_level"),
    col("city"),
    col("state"),
    col("department"),
    col("contact_person_name"),
    col("designation"),
    w("email"),
    w("phone"),
    col("address"),
    col("website_url"),
    col("empanelment_page_url"),
    col("method_of_contact"),
    col("empanelment_open_window"),
    w("approach_notes"),
    col("confidence"),
    col("source_url"),
  ],
};

export const ASSOCIATION_OFFICERS: TabSpec = {
  id: "association_officers",
  expectedTitle: "Association Officers",
  signature: ["organisation", "branch", "person_name", "designation", "term_year"],
  keyColumns: ["officer_id"],
  fallbackKeyColumns: ["organisation", "branch", "person_name"],
  bannerRows: 1,
  columns: [
    col("officer_id", { optional: true }),
    col("organisation"),
    col("branch"),
    col("city"),
    col("state"),
    col("person_name"),
    col("designation"),
    w("mobile"),
    w("alt_phone"),
    w("email"),
    col("address"),
    col("term_year"),
    w("notes"),
    col("source_url"),
  ],
};

export const IOV_MEMBERSHIPS: TabSpec = {
  id: "iov_memberships",
  expectedTitle: "IOV Memberships",
  signature: ["person_id", "name_key", "iov_membership_no", "match_confidence"],
  keyColumns: ["person_id", "iov_membership_no"],
  bannerRows: 1,
  personIdColumn: "person_id",
  columns: [
    "person_id", "name_key", "our_state", "iov_state", "iov_membership_no",
    "iov_asset_class", "iov_approved_valuer", "match_confidence",
  ].map((h) => col(h)),
};

export const SOURCE_INVENTORY: TabSpec = {
  id: "source_inventory",
  expectedTitle: "Source Inventory",
  signature: ["source", "rows_captured", "l_and_b_rows_used", "url_or_note"],
  keyColumns: ["source"],
  columns: ["source", "type", "rows_captured", "l_and_b_rows_used", "contributed", "status", "url_or_note"].map((h) => col(h)),
};

export const PROSPECT_INTELLIGENCE: TabSpec = {
  id: "prospect_intelligence",
  expectedTitle: "Prospect Intelligence",
  signature: ["Research Status", "Person ID", "Opportunity Score /100", "Primary Wedge"],
  keyColumns: ["Person ID"],
  fallbackKeyColumns: ["Full Name"],
  personIdColumn: "Person ID",
  columns: [
    w("Research Status"),
    w("Priority"),
    col("Person ID"),
    col("Full Name"),
    col("City"),
    col("State"),
    col("Practice / Firm"),
    col("IBBI Reg No"),
    col("RVO"),
    w("Public Phone"),
    w("Public Email"),
    col("Website"),
    w("LinkedIn"),
    col("Verified Current Bank / Lender Relationships"),
    col("Relationship Evidence / Recency"),
    col("Association / Influence Role"),
    col("Bank-Side Contact / Decision Path"),
    col("Warm Referral Path"),
    col("Evidence-Backed Workflow Signal"),
    col("Pain Point Hypothesis (Inferred)"),
    col("Valytica Angle"),
    w("Best First Channel"),
    w("Personalized Opening Angle"),
    col("Lead Role"),
    col("Competitor / Risk Note"),
    w("Last Researched", "date"),
    col("Source URLs"),
    col("Confidence"),
    w("Active Practice /20", "number"),
    w("Workflow Pain /20", "number"),
    w("Valytica Fit /20", "number"),
    w("Commercial Potential /15", "number"),
    w("Reachability /10", "number"),
    w("Influence /5", "number"),
    w("Evidence Confidence /10", "number"),
    d("Opportunity Score /100"),
    d("Score Band"),
    col("Research Completeness %"),
    w("Score Reason"),
    w("Score Gaps / Unknowns"),
    col("Primary Wedge"),
    col("Primary Trigger"),
    w("Next Action"),
    w("Score Last Reviewed", "date"),
  ],
};

export const REFERRAL_MAP: TabSpec = {
  id: "referral_map",
  expectedTitle: "Referral Map",
  signature: ["Relationship Type", "Institution / Association", "Recommended Ask", "Evidence Date"],
  keyColumns: ["Institution / Association", "Contact / Role"],
  columns: [
    col("Relationship Type"),
    col("Institution / Association"),
    col("Region"),
    col("Contact / Role"),
    col("Phone"),
    col("Email"),
    col("Relevant Prospects"),
    col("Why This Matters"),
    col("Recommended Ask"),
    col("Evidence Date"),
    col("Source URL"),
    col("Confidence"),
    w("Status"),
    w("Owner"),
    w("Next Action"),
    w("Notes"),
  ],
};

export const RESEARCH_QUEUE: TabSpec = {
  id: "research_queue",
  expectedTitle: "Research Queue",
  signature: ["Person ID", "Why Prioritized", "Next Research Task", "Target Completion Order"],
  keyColumns: ["Person ID"],
  fallbackKeyColumns: ["Full Name"],
  personIdColumn: "Person ID",
  columns: [
    w("Priority"),
    col("Person ID"),
    col("Full Name"),
    col("State"),
    col("City"),
    w("Research Status"),
    col("Why Prioritized"),
    w("Missing Phone"),
    w("Missing Current Bank Proof"),
    w("Missing Association / Referral"),
    w("Missing Firm / Tooling"),
    w("Next Research Task"),
    w("Target Completion Order"),
    w("Notes"),
  ],
};

export const GTM_PERSONAS: TabSpec = {
  id: "gtm_personas",
  expectedTitle: "GTM Personas",
  signature: ["Persona", "GTM Role", "Buyer/User/Influencer", "Best Hook"],
  keyColumns: ["Persona"],
  columns: [
    "Persona", "GTM Role", "Priority", "Buyer/User/Influencer", "Why It Matters", "What We Want",
    "Best Hook", "Content / Demo To Show", "What To Avoid", "Research Criteria",
  ].map((h) => col(h)),
};

export const DEEP_DIVE_DOSSIERS: TabSpec = {
  id: "deep_dive_dossiers",
  expectedTitle: "Deep Dive Dossiers",
  signature: ["Prospect / Contact ID", "WhatsApp Opener", "Demo Sequence", "Valytica Wedge"],
  keyColumns: ["Prospect / Contact ID"],
  fallbackKeyColumns: ["Name"],
  personIdColumn: "Prospect / Contact ID",
  columns: [
    w("Status"),
    w("Priority"),
    col("Prospect / Contact ID"),
    col("Name"),
    col("Persona / GTM Role"),
    col("City"),
    col("State"),
    col("Organisation / Practice"),
    col("Why This Person Now"),
    col("Evidence / Proof"),
    col("Likely Trigger"),
    col("Pain Narrative"),
    col("Valytica Wedge"),
    col("One-Line Pitch"),
    w("WhatsApp Opener"),
    w("Call Opener"),
    w("Email / LinkedIn Angle"),
    w("Content Asset To Share"),
    col("Custom Story / Content Idea"),
    w("Demo Sequence"),
    col("Public Phone"),
    col("Public Email"),
    col("Relevant People / Warm Paths"),
    col("Bank / Lender Contacts"),
    col("Source URLs"),
    w("Next Action"),
  ],
};

/**
 * ONE research tab, replacing Prospect Intelligence + Deep Dive Dossiers +
 * Research Queue.
 *
 * Those three hold 84 columns describing 27 people, and 22 of the 27 appear in
 * ALL THREE. Fourteen concepts are duplicated between the first two under
 * different names — Pain Point Hypothesis / Pain Narrative, Valytica Angle /
 * Valytica Wedge, Primary Trigger / Likely Trigger, Warm Referral Path /
 * Relevant People & Warm Paths, Bank-Side Contact / Bank & Lender Contacts —
 * and nothing reconciles them, so two of them disagreeing is invisible.
 *
 * What is NOT here is as deliberate as what is. Everything that is an attribute
 * of a PERSON moved to People in #151 and is not repeated: research_status,
 * priority, opportunity_score, score_band, persona, best_first_channel,
 * next_action, why_now, pain, plus identity, city, state, phone and email. This
 * tab holds only what a person's own row cannot — the long-form research and
 * the scoring working-out. `Name` is here as a label so a human can read a row
 * without a lookup; `Person ID` is the key and the only identity that counts.
 *
 * `Opportunity Score /100` and `Score Band` are `derived` because they are a
 * formula over the seven sub-scores. On Prospect Intelligence the score was
 * hand-typed beside its own inputs — the same defect class as `source_count`,
 * which disagreed with the list next to it on 75 rows.
 */
export const PROSPECT_RESEARCH: TabSpec = {
  id: "prospect_research",
  expectedTitle: "Prospect Research",
  signature: ["Person ID", "Valytica Wedge", "WhatsApp Opener", "Why Prioritized"],
  keyColumns: ["Person ID"],
  fallbackKeyColumns: ["Name"],
  personIdColumn: "Person ID",
  pending: true,
  columns: [
    col("Person ID"),
    col("Name"),

    // Evidence and relationships — what makes a claim about this person checkable.
    w("Verified Bank Relationships"),
    w("Relationship Evidence"),
    w("Evidence / Proof"),
    w("Association / Influence Role"),
    w("Bank-Side Contacts"),
    w("Warm Paths"),

    // Positioning.
    w("Workflow Signal"),
    w("Likely Trigger"),
    w("Valytica Wedge"),
    w("One-Line Pitch"),
    w("Competitor / Risk Note"),

    // Openers. The channel itself lives on People; these are the words.
    w("Opening Angle"),
    w("WhatsApp Opener"),
    w("Call Opener"),
    w("Email / LinkedIn Angle"),
    w("Demo Sequence"),
    w("Content Asset To Share"),
    w("Custom Story / Content Idea"),

    // Scoring. The seven inputs are written; the total is computed from them.
    w("Active Practice /20", "number"),
    w("Workflow Pain /20", "number"),
    w("Valytica Fit /20", "number"),
    w("Commercial Potential /15", "number"),
    w("Reachability /10", "number"),
    w("Influence /5", "number"),
    w("Evidence Confidence /10", "number"),
    d("Opportunity Score /100"),
    d("Score Band"),
    w("Score Reason"),
    w("Score Gaps / Unknowns"),
    w("Research Completeness %"),
    w("Score Last Reviewed", "date"),

    /**
     * Distinct from People's `next_action`, which the #151 fold filled from
     * Research Queue's "Next Research Task" — i.e. the next thing to FIND OUT.
     * This is the next thing to DO to the prospect, and it is what Prospect
     * Intelligence and Deep Dive Dossiers both called "Next Action" on 22 and
     * 27 rows. Two columns with one name meaning two things is the disease this
     * merge is curing, so the name says which one it is.
     */
    w("Next Outreach Action"),

    // Queue state — what is still owed on this person.
    w("Why Prioritized"),
    w("Missing Phone"),
    w("Missing Current Bank Proof"),
    w("Missing Association / Referral"),
    w("Missing Firm / Tooling"),
    w("Target Completion Order"),
    w("Notes"),

    // Provenance.
    w("Source URLs"),
    w("Last Researched", "date"),
    w("Confidence"),
  ],
};

export const EXCLUSIONS: TabSpec = {
  id: "exclusions",
  expectedTitle: "Exclusions",
  signature: ["Entity / Person", "Aliases / Related Names", "Applies To", "Date Added"],
  keyColumns: ["Entity / Person"],
  columns: [
    "Entity / Person", "Type", "Aliases / Related Names", "Action", "Reason", "Applies To", "Date Added", "Notes",
  ].map((h) => col(h)),
};

export const TAB_SPECS: TabSpec[] = [
  PEOPLE,
  COMPANIES,
  RVOS,
  LENDER_LANDSCAPE,
  LENDER_CONTACTS,
  ASSOCIATION_OFFICERS,
  IOV_MEMBERSHIPS,
  SOURCE_INVENTORY,
  PROSPECT_INTELLIGENCE,
  REFERRAL_MAP,
  RESEARCH_QUEUE,
  PROSPECT_RESEARCH,
  GTM_PERSONAS,
  DEEP_DIVE_DOSSIERS,
  EXCLUSIONS,
];

export const TAB_SPEC_BY_ID = Object.fromEntries(TAB_SPECS.map((t) => [t.id, t])) as Record<TabId, TabSpec>;

export function isTabId(v: string): v is TabId {
  return (TAB_IDS as readonly string[]).includes(v);
}

export function columnSpec(tab: TabSpec, header: string): ColumnSpec | undefined {
  return tab.columns.find((c) => c.header === header);
}

/** True when Internal may write this column: declared writable and not derived. */
export function isWritableColumn(tab: TabSpec, header: string): boolean {
  const c = columnSpec(tab, header);
  return Boolean(c && c.writable && !c.derived);
}

export function isDerivedColumn(tab: TabSpec, header: string): boolean {
  return Boolean(columnSpec(tab, header)?.derived);
}

const normHeader = (h: unknown) => String(h ?? "").trim();

/**
 * Find the header row of a tab: the first of the leading rows that carries
 * every signature header. Returns the row index (0-based) and the header
 * list as printed, or null when no spec matches.
 */
export function detectHeaderRow(
  rows: unknown[][],
  spec: TabSpec,
  maxScan = 6,
): { rowIndex: number; headers: string[] } | null {
  for (let i = 0; i < Math.min(rows.length, maxScan); i++) {
    const headers = (rows[i] ?? []).map(normHeader);
    if (spec.signature.every((s) => headers.includes(s))) return { rowIndex: i, headers };
  }
  return null;
}

/** Which spec a sheet's leading rows belong to, if any. */
export function identifyTab(rows: unknown[][]): { spec: TabSpec; rowIndex: number; headers: string[] } | null {
  for (const spec of TAB_SPECS) {
    const hit = detectHeaderRow(rows, spec);
    if (hit) return { spec, ...hit };
  }
  return null;
}

export type HeaderDrift = {
  /** Declared (non-optional) headers the sheet no longer carries. */
  missing: string[];
  /** Headers the sheet carries that the mapping does not know. Synced verbatim. */
  unknown: string[];
  /** Optional (requested) headers that are present. */
  optionalPresent: string[];
};

export function headerDrift(spec: TabSpec, headers: string[]): HeaderDrift {
  const present = new Set(headers.map(normHeader).filter(Boolean));
  const declared = new Set(spec.columns.map((c) => c.header));
  return {
    missing: spec.columns.filter((c) => !c.optional && !present.has(c.header)).map((c) => c.header),
    unknown: [...present].filter((h) => !declared.has(h)),
    optionalPresent: spec.columns.filter((c) => c.optional && present.has(c.header)).map((c) => c.header),
  };
}

/** Compose a row's key from its record. `null` when no key column has a value. */
export function rowKeyFor(spec: TabSpec, record: Record<string, string>): { key: string; weak: boolean } | null {
  const pick = (cols: string[]) => cols.map((c) => (record[c] ?? "").trim());
  const primary = pick(spec.keyColumns);
  if (primary.some(Boolean)) return { key: primary.join("|"), weak: false };
  if (spec.fallbackKeyColumns) {
    const fb = pick(spec.fallbackKeyColumns);
    if (fb.some(Boolean)) return { key: fb.join("|"), weak: true };
  }
  return null;
}

/** Column letter for a 0-based index (0 → A, 26 → AA). */
export function columnLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** A1 range for one cell. Tab titles are always quoted; a title may contain spaces or slashes. */
export function a1(tabTitle: string, rowIndex0: number, colIndex0: number): string {
  return `'${tabTitle.replace(/'/g, "''")}'!${columnLetter(colIndex0)}${rowIndex0 + 1}`;
}
