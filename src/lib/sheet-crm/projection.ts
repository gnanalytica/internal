import {
  firstOf,
  isInstitutionalSpecialisation,
  normEnum,
  parseSheetDate,
  splitMulti,
  toE164India,
  toInt,
} from "./parse";

/**
 * Pure projections from sheet records onto the typed CRM columns. No I/O, so
 * `projection.test.ts` can pin every rule the prospect list depends on.
 */

export const SHEET_SOURCE = "valytica-sheet";

export type SheetRecord = Record<string, string>;

export type PersonProjection = {
  externalSource: string;
  externalId: string;
  name: string;
  email: string | null;
  phone: string | null;
  phoneE164: string | null;
  title: string | null;
  source: string | null;
  leadScore: number | null;
  city: string | null;
  state: string | null;
  ibbiRegNo: string | null;
  rvo: string | null;
  priority: string | null;
  opportunityScore: number | null;
  scoreBand: string | null;
  researchStatus: string | null;
  bestFirstChannel: string | null;
  persona: string | null;
  entity: string;
  channel: string;
  /** Sheet-side outreach columns, when the owner has added them. */
  outreachStatus: string | null;
  lastContactedAt: Date | null;
};

const blank = (v: string | undefined | null) => (v && v.trim() ? v.trim() : null);

/**
 * Project one People row, enriched with its Prospect Intelligence and Deep Dive
 * rows when they exist. Institutional rows (bank-side people the owner put in
 * People) are recognised by the INSTITUTIONAL prefix on `specialisation` — the
 * owner's convention — never by blank IBBI / RVO fields.
 */
export function projectPerson(
  people: SheetRecord,
  gtm: { prospect?: SheetRecord; dossier?: SheetRecord } = {},
): PersonProjection {
  const institutional = isInstitutionalSpecialisation(people.specialisation);
  const p = gtm.prospect;
  const phoneRaw = blank(people.phone) ?? blank(p?.["Public Phone"]);
  const emailRaw = firstOf(people.email) ?? firstOf(p?.["Public Email"]);
  const persona = institutional
    ? "institutional"
    : blank(gtm.dossier?.["Persona / GTM Role"]) ?? blank(p?.["Lead Role"]);
  return {
    externalSource: SHEET_SOURCE,
    externalId: people.person_id.trim(),
    name: blank(people.full_name) ?? people.person_id.trim(),
    email: emailRaw,
    phone: phoneRaw,
    phoneE164: toE164India(phoneRaw),
    title: blank(people.specialisation) ?? blank(people.firm_name),
    source: blank(people.sources),
    leadScore: toInt(people.lead_score),
    city: blank(people.city) ?? blank(p?.City),
    state: blank(people.state) ?? blank(p?.State),
    ibbiRegNo: blank(people.ibbi_reg_no) ?? blank(p?.["IBBI Reg No"]),
    rvo: blank(people.rvo),
    priority: blank(p?.Priority)?.toUpperCase() ?? null,
    opportunityScore: toInt(p?.["Opportunity Score /100"]),
    scoreBand: blank(p?.["Score Band"])?.toUpperCase() ?? null,
    researchStatus: blank(p?.["Research Status"]) ?? blank(gtm.dossier?.Status),
    bestFirstChannel: blank(p?.["Best First Channel"]),
    persona,
    entity: "India",
    channel: institutional ? "lender" : "direct",
    outreachStatus: normEnum(people.outreach_status),
    lastContactedAt: sheetTimestamp(people.last_contacted_at),
  };
}

export type CompanyProjection = {
  externalSource: string;
  externalId: string;
  name: string;
  website: string | null;
  industry: string;
  city: string | null;
  state: string | null;
  ibbiEntityRegNo: string | null;
  constitution: string | null;
  pnbCategory: string | null;
  researchConfidence: string | null;
  entity: string;
  outreachStatus: string | null;
  lastContactedAt: Date | null;
  /** person_ids named in `linked_person_ids`, cleaned. */
  linkedPersonIds: string[];
};

export function projectCompany(c: SheetRecord): CompanyProjection {
  return {
    externalSource: SHEET_SOURCE,
    externalId: c.company_id.trim(),
    name: blank(c.company_name) ?? c.company_id.trim(),
    website: blank(c.website),
    industry: "Property valuation",
    city: blank(c.city),
    state: blank(c.state),
    ibbiEntityRegNo: blank(c.ibbi_entity_reg_no),
    constitution: blank(c.constitution),
    pnbCategory: blank(c.pnb_category)?.toUpperCase() ?? null,
    researchConfidence: normEnum(c.research_confidence),
    entity: "India",
    outreachStatus: normEnum(c.outreach_status),
    lastContactedAt: sheetTimestamp(c.last_contacted_at),
    linkedPersonIds: splitMulti(c.linked_person_ids).filter((id) => /^P\d{5}$/.test(id)),
  };
}

/** A sheet date cell → Date at noon UTC, so it never shifts a calendar day. */
export function sheetTimestamp(v: string | undefined | null): Date | null {
  const iso = parseSheetDate(v);
  if (iso) return new Date(`${iso}T12:00:00Z`);
  const t = v ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? new Date(t) : null;
}

/**
 * Exclusion matching: the sheet's `Exclusions` tab names entities and their
 * aliases; a person or company matches when its name, or any alias, equals
 * the entry's name or one of its aliases after normalisation. Substring
 * matching is deliberate for organisations (a firm is often written with or
 * without "Pvt Ltd"), exact for people.
 */
export type ExclusionEntry = { name: string; type: string; aliases: string[]; action: string; reason: string };

export function parseExclusions(rows: SheetRecord[]): ExclusionEntry[] {
  return rows
    .filter((r) => blank(r["Entity / Person"]))
    .map((r) => ({
      name: r["Entity / Person"].trim(),
      type: (r.Type ?? "").trim().toLowerCase(),
      aliases: splitMulti(r["Aliases / Related Names"]),
      action: (r.Action ?? "").trim(),
      reason: (r.Reason ?? "").trim(),
    }));
}

const nameKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function matchesExclusion(name: string, entries: ExclusionEntry[]): ExclusionEntry | null {
  const key = nameKey(name);
  if (!key) return null;
  for (const e of entries) {
    const keys = [e.name, ...e.aliases].map(nameKey).filter((k) => k.length >= 4);
    if (e.type === "person") {
      if (keys.includes(key)) return e;
    } else if (keys.some((k) => key.includes(k) || k.includes(key))) {
      return e;
    }
  }
  return null;
}
