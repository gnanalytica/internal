import { COMPANIES, PEOPLE, type TabSpec } from "./mapping";

/**
 * How the masters' columns are grouped on a person / company page. Client-safe.
 * A column not listed here still renders, under "Other".
 */
export const PEOPLE_GROUPS: { title: string; headers: string[] }[] = [
  { title: "Identity", headers: ["person_id", "full_name", "ibbi_reg_no", "ibbi_asset_class", "ibbi_reg_date", "rvo", "other_asset_classes"] },
  { title: "Contact", headers: ["email", "phone", "whatsapp_available", "website", "linkedin", "address", "city", "state", "pincode", "is_south_india"] },
  { title: "Practice", headers: ["firm_name", "company_names", "company_ibbi_reg_nos", "company_link_source", "firm_size", "years_practice", "specialisation", "associations_and_roles", "current_tooling_signal"] },
  { title: "Panels & sources", headers: ["empanelled_with", "num_empanelments", "pnb_zone", "pnb_category", "pnb_constitution", "sources", "source_count", "enrichment_sources", "lead_score"] },
  { title: "IOV", headers: ["iov_membership_no", "iov_asset_class", "iov_approved_valuer", "iov_match_confidence"] },
  { title: "Research", headers: ["sales_angle", "research_confidence", "remarks", "data_quality_flag", "outreach_status", "last_contacted_at"] },
  { title: "Entity resolution", headers: ["canonical_entity_key", "normalized_name_key", "duplicate_flag", "duplicate_match_ids", "match_rule"] },
];

export const COMPANY_GROUPS: { title: string; headers: string[] }[] = [
  { title: "Identity", headers: ["company_id", "company_name", "constitution", "ibbi_entity_reg_no", "asset_classes", "ibbi_reg_date", "rvo"] },
  { title: "Contact", headers: ["email", "phone", "website", "linkedin", "address", "city", "state", "pincode", "is_south_india"] },
  { title: "People", headers: ["key_people", "key_people_ibbi_reg_nos", "linked_person_ids", "num_linked_people", "decision_makers", "decision_maker_contacts", "num_valuers"] },
  { title: "Practice", headers: ["branch_offices", "service_lines", "volume_signal", "current_tooling_signal"] },
  { title: "Panels & sources", headers: ["empanelled_with", "pnb_zone", "pnb_category", "sources", "enrichment_sources"] },
  { title: "Research", headers: ["sales_angle", "research_confidence", "remarks", "outreach_status", "last_contacted_at"] },
  { title: "Entity resolution", headers: ["canonical_entity_key", "normalized_name_key", "duplicate_flag", "duplicate_match_ids", "match_rule"] },
];

/** Long-form columns that want a textarea rather than a one-line input. */
export const LONG_TEXT = new Set([
  "sales_angle", "remarks", "current_tooling_signal", "enrichment_sources", "decision_makers", "decision_maker_contacts",
  "empanelled_with", "address", "associations_and_roles", "branch_offices", "service_lines", "volume_signal",
  "Personalized Opening Angle", "Next Action", "Score Reason", "Score Gaps / Unknowns", "WhatsApp Opener", "Call Opener",
  "Email / LinkedIn Angle", "Demo Sequence", "Content Asset To Share", "Notes", "Next Research Task", "Missing Phone",
  "Missing Current Bank Proof", "Missing Association / Referral", "Missing Firm / Tooling", "approach_notes", "notes",
]);

export function groupsFor(spec: TabSpec): { title: string; headers: string[] }[] {
  return spec === PEOPLE ? PEOPLE_GROUPS : spec === COMPANIES ? COMPANY_GROUPS : [];
}

/** Human label for a header: snake_case → words; Title Case stays. */
export function headerLabel(h: string): string {
  if (/[A-Z]/.test(h) && /\s/.test(h)) return h;
  return h.replace(/_/g, " ").replace(/\b(ibbi|iov|pnb|rvo|id|url|lb)\b/gi, (m) => m.toUpperCase());
}
