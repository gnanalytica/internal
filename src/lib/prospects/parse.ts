import { ID_COLUMN, SCORE_COLUMNS, STAGES, TAB, type ProspectKind } from "./schema";

/** One row of Registered Valuers, Valuer Firms or RVOs, keyed by its registration number. */
export type ProspectRecord = {
  kind: ProspectKind;
  id: string;
  name: string;
  status: string;
  /** Index into STAGES; a blank or unrecognised status counts as "Not contacted". */
  stage: number;
  state: string;
  city: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  rvo: string;
  registeredOn: string;
  firmRegNo: string;
  firmStatus: string;
  keyContact: string;
  people: string;
  lenders: string[];
  software: string;
  casesPerMonth: number | null;
  assigned: string;
  outreachRoute: string;
  /** ISO yyyy-mm-dd, or null. */
  lastContacted: string | null;
  nextStep: string;
  nextStepDate: string | null;
  drafts: { email: string; whatsapp: string; call: string; meeting: string };
  notes: string;
  scores: (number | null)[];
  switchingBarrier: number | null;
  disqualified: string;
  opportunityScore: number | null;
  /** A, B, C, Watch, Disqualified, Incomplete — or "" when the sheet has nothing. */
  band: string;
  bandLabel: string;
  scoreReason: string;
  scoreGaps: string;
  researchStatus: string;
  researchSources: { what: string; url: string }[];
  lastResearched: string | null;
  pitchAngle: string;
  objections: string;
  referredBy: string;
};

export type ActivityEntry = {
  id: string;
  loggedAt: string;
  /** ISO yyyy-mm-dd of loggedAt, for bucketing. */
  date: string | null;
  recordType: string;
  registrationNo: string;
  name: string;
  by: string;
  channel: string;
  direction: string;
  outcome: string;
  durationMin: number | null;
  statusAfter: string;
  summary: string;
};

export type ProspectsWorkbook = {
  valuers: ProspectRecord[];
  firms: ProspectRecord[];
  rvos: ProspectRecord[];
  activity: ActivityEntry[];
  /** Problems worth showing rather than hiding: a missing tab, a duplicate ID. */
  warnings: string[];
  readAt: string;
};

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number | string) => String(n).padStart(2, "0");

/**
 * A sheet date as ISO yyyy-mm-dd. Dashes are the sheet's own dd-mm-yyyy
 * format; slashes are what an unformatted cell renders as in the workbook's
 * en_US locale, i.e. m/d/yyyy; "30 Jun, 2018" is how IBBI writes dates.
 */
export function parseSheetDate(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${pad(m[1])}-${pad(m[2])}`;
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*,?\s+(\d{4})$/);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(m[1])}`;
  return null;
}

/** ISO yyyy-mm-dd → dd-mm-yyyy, the sheet's display format. */
export function displayDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

export function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

export function cellNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function stageIndex(status: string): number {
  const i = STAGES.findIndex((s) => s.toLowerCase() === status.trim().toLowerCase());
  return i < 0 ? 0 : i;
}

/** "A", "B", "C", "Watch", "Disqualified", "Incomplete 5/8" → a band key. */
export function bandKey(label: string): string {
  const s = label.trim();
  if (!s) return "";
  if (s.startsWith("Incomplete")) return "Incomplete";
  return s;
}

/** `lenders_empanelled_with` is semicolon-separated. */
export function splitList(v: string): string[] {
  return v
    .split(/[;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** `research_sources`: one link per line, each "what: url". */
export function parseSources(v: string): { what: string; url: string }[] {
  return v
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (/^https?:\/\//i.test(line)) return { what: "", url: line };
      const m = line.match(/^([^:]{1,40}):\s*(\S.*)$/);
      return m ? { what: m[1].trim(), url: m[2].trim() } : { what: "", url: line };
    });
}

type Row = unknown[];

/** Header name → column index, for the first row of a tab. */
export function headerIndex(header: Row): Map<string, number> {
  const map = new Map<string, number>();
  header.forEach((h, i) => {
    const key = cellText(h);
    if (key && !map.has(key)) map.set(key, i);
  });
  return map;
}

function getter(idx: Map<string, number>, row: Row) {
  return (col: string): unknown => {
    const i = idx.get(col);
    return i === undefined ? undefined : row[i];
  };
}

export function parseRecords(kind: ProspectKind, matrix: unknown[][], warnings: string[]): ProspectRecord[] {
  if (!matrix.length) {
    warnings.push(`The "${TAB[kind]}" tab is missing or empty.`);
    return [];
  }
  const idx = headerIndex(matrix[0]);
  const idCol = ID_COLUMN[kind];
  if (!idx.has(idCol)) {
    warnings.push(`The "${TAB[kind]}" tab has no ${idCol} column, so none of its rows can be identified.`);
    return [];
  }
  const seen = new Set<string>();
  const out: ProspectRecord[] = [];
  for (const row of matrix.slice(1)) {
    const g = getter(idx, row);
    const t = (c: string) => cellText(g(c));
    const id = t(idCol);
    if (!id) continue;
    if (seen.has(id)) {
      warnings.push(`${TAB[kind]}: ${id} appears on more than one row; only the first is shown and edits to it are refused.`);
      continue;
    }
    seen.add(id);
    const status = t("status");
    const bandLabel = t("score_band");
    out.push({
      kind,
      id,
      name: t("name"),
      status,
      stage: stageIndex(status),
      state: t("state"),
      city: t("city"),
      address: t("address"),
      email: t("email"),
      phone: t("phone"),
      website: t("website"),
      rvo: t("rvo_enrolled"),
      registeredOn: t("date_of_registration"),
      firmRegNo: t("valuer_firm_registration_no"),
      firmStatus: t("firm_status"),
      keyContact: t("key_contact") || t("chairperson_president"),
      people: t("directors_partners") || t("ceo_md"),
      lenders: splitList(t("lenders_empanelled_with")),
      software: t("current_software"),
      casesPerMonth: cellNumber(g("lb_cases_per_month")),
      assigned: t("assigned"),
      outreachRoute: t("outreach_route"),
      lastContacted: parseSheetDate(g("last_contacted")),
      nextStep: t("next_step"),
      nextStepDate: parseSheetDate(g("next_step_date")),
      drafts: { email: t("draft_email"), whatsapp: t("draft_whatsapp"), call: t("draft_call"), meeting: t("draft_meeting") },
      notes: t("notes"),
      scores: SCORE_COLUMNS.map((s) => cellNumber(g(s.key))),
      switchingBarrier: cellNumber(g("switching_barrier")),
      disqualified: t("disqualified"),
      opportunityScore: cellNumber(g("opportunity_score")),
      band: bandKey(bandLabel),
      bandLabel,
      scoreReason: t("score_reason"),
      scoreGaps: t("score_gaps"),
      researchStatus: t("research_status"),
      researchSources: parseSources(t("research_sources")),
      lastResearched: parseSheetDate(g("last_researched")),
      pitchAngle: t("pitch_angle"),
      objections: t("objections"),
      referredBy: t("referred_by"),
    });
  }
  return out;
}

export function parseActivity(matrix: unknown[][], warnings: string[]): ActivityEntry[] {
  if (!matrix.length) {
    warnings.push(`The "${TAB.activity}" tab is missing, so call and reply history cannot be shown.`);
    return [];
  }
  const idx = headerIndex(matrix[0]);
  const out: ActivityEntry[] = [];
  for (const row of matrix.slice(1)) {
    const g = getter(idx, row);
    const t = (c: string) => cellText(g(c));
    if (!t("registration_no") && !t("activity_id")) continue;
    const loggedAt = t("logged_at");
    out.push({
      id: t("activity_id"),
      loggedAt,
      date: parseSheetDate(loggedAt),
      recordType: t("record_type"),
      registrationNo: t("registration_no"),
      name: t("name"),
      by: t("by"),
      channel: t("channel"),
      direction: t("direction"),
      outcome: t("outcome"),
      durationMin: cellNumber(g("duration_min")),
      statusAfter: t("status_after"),
      summary: t("summary"),
    });
  }
  return out;
}

export function parseWorkbook(tabs: Map<string, unknown[][]>, readAt: string): ProspectsWorkbook {
  const warnings: string[] = [];
  return {
    valuers: parseRecords("valuer", tabs.get(TAB.valuer) ?? [], warnings),
    firms: parseRecords("firm", tabs.get(TAB.firm) ?? [], warnings),
    rvos: parseRecords("rvo", tabs.get(TAB.rvo) ?? [], warnings),
    activity: parseActivity(tabs.get(TAB.activity) ?? [], warnings),
    warnings,
    readAt,
  };
}
