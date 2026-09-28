/**
 * The prospects workbook as the dashboard understands it. Columns are always
 * found by their header name, never by position — people move columns around
 * in the sheet — and rows are always found by their registration number,
 * never by row number, because sorting and filtering reorder them at any time.
 */

export const DEFAULT_PROSPECTS_SHEET_ID = "1VI4vbw9tXia7rQGw1A2W3XK71LyApHSWEpVumXsufk0";

export function prospectsSheetId(): string {
  return process.env.PROSPECTS_SHEET_ID || DEFAULT_PROSPECTS_SHEET_ID;
}

export function prospectsSheetUrl(): string {
  return `https://docs.google.com/spreadsheets/d/${prospectsSheetId()}/edit`;
}

export const PROSPECT_KINDS = ["valuer", "firm", "rvo"] as const;
export type ProspectKind = (typeof PROSPECT_KINDS)[number];

export const TAB: Record<ProspectKind | "activity", string> = {
  valuer: "Registered Valuers",
  firm: "Valuer Firms",
  rvo: "RVOs",
  activity: "Activity",
};

export const ID_COLUMN: Record<ProspectKind, string> = {
  valuer: "registration_no",
  firm: "registration_no",
  rvo: "rvo_recognition_no",
};

export const KIND_LABEL: Record<ProspectKind, { one: string; many: string }> = {
  valuer: { one: "Registered valuer", many: "Valuers" },
  firm: { one: "Valuer firm", many: "Firms" },
  rvo: { one: "RVO", many: "RVOs" },
};

/** Activity's record_type values, per kind. */
export const RECORD_TYPE: Record<ProspectKind, string> = { valuer: "Valuer", firm: "Firm", rvo: "RVO" };

export const STAGES = ["Not contacted", "Contacted", "Discovery done", "Demo done", "Pilot running", "Won", "Lost"] as const;
export type Stage = (typeof STAGES)[number];

export const PITCH_ANGLES = [
  "Faster reports",
  "Documents read for you",
  "Defensible evidence",
  "Site visit & photos",
  "Team & case tracking",
  "Portal checks",
] as const;

export const OBJECTIONS = [
  "Happy with current software",
  "Too busy to try something new",
  "Low case volume",
  "Doesn't trust AI",
  "Price",
  "Bank gives us the format",
  "Team won't change how they work",
  "Worried about data privacy",
] as const;

export const CHANNELS = ["WhatsApp", "Email", "Call", "Meeting", "Other"] as const;
export type Channel = (typeof CHANNELS)[number];

export const DIRECTIONS = ["Outbound", "Inbound"] as const;

export const OUTCOMES = [
  "Sent",
  "Replied",
  "Connected",
  "No answer",
  "Busy — call back",
  "Wrong number",
  "Not interested",
  "Demo booked",
  "Meeting held",
] as const;
export type Outcome = (typeof OUTCOMES)[number];

/** Outcomes that count as the other side engaging, for reply/connect rates. */
export const ENGAGED_OUTCOMES: ReadonlySet<string> = new Set(["Replied", "Connected", "Demo booked", "Meeting held"]);

export const RESEARCH_STATUSES = ["Profiled", "Scored — needs review", "Reviewed", "Needs a person"] as const;

export const DISQUALIFY_REASONS = [
  "Registration suspended",
  "Works for a lender or competitor",
  "Asked not to be contacted",
  "Not practising L&B",
] as const;

export const SCORE_COLUMNS = [
  { key: "active_practice", label: "Active practice", max: 20 },
  { key: "workflow_pain", label: "Workflow pain", max: 20 },
  { key: "valytica_fit", label: "Valytica fit", max: 15 },
  { key: "commercial_potential", label: "Commercial potential", max: 15 },
  { key: "reachability", label: "Reachability", max: 10 },
  { key: "timing", label: "Timing", max: 10 },
  { key: "evidence_confidence", label: "Evidence confidence", max: 5 },
  { key: "influence_network", label: "Influence network", max: 5 },
] as const;

/** The states the team is working first; everything else is behind "All India". */
export const FOCUS_STATES = ["Karnataka", "Andhra Pradesh", "Telangana"] as const;

export const SPRINT_TARGETS = [
  { label: "Hyderabad", match: { city: "Hyderabad" }, target: 50 },
  { label: "Bangalore", match: { city: "Bangalore" }, target: 50 },
  { label: "Andhra Pradesh", match: { state: "Andhra Pradesh" }, target: 30 },
] as const;

/**
 * Columns the dashboard may write, per tab. Everything else — the IBBI
 * register columns, the scores, and above all the formula columns — is
 * read-only here and stays the sheet's business.
 */
export const WRITABLE: Record<ProspectKind, ReadonlySet<string>> = {
  valuer: new Set([
    "status",
    "city",
    "phone",
    "lenders_empanelled_with",
    "current_software",
    "lb_cases_per_month",
    "assigned",
    "outreach_route",
    "last_contacted",
    "next_step",
    "next_step_date",
    "draft_email",
    "draft_whatsapp",
    "draft_call",
    "draft_meeting",
    "notes",
    "disqualified",
    "research_status",
    "pitch_angle",
    "objections",
    "referred_by",
  ]),
  firm: new Set([
    "status",
    "assigned",
    "key_contact",
    "last_contacted",
    "next_step",
    "next_step_date",
    "notes",
    "pitch_angle",
    "objections",
    "referred_by",
  ]),
  rvo: new Set([
    "status",
    "assigned",
    "outreach_route",
    "last_contacted",
    "next_step",
    "next_step_date",
    "draft_email",
    "draft_whatsapp",
    "draft_call",
    "draft_meeting",
    "notes",
  ]),
};

/** Written as real dates (ISO, which every locale parses) so the column's dd-mm-yyyy format applies. */
export const DATE_COLUMNS: ReadonlySet<string> = new Set(["last_contacted", "next_step_date", "last_researched"]);
/** Written as numbers. */
export const NUMBER_COLUMNS: ReadonlySet<string> = new Set(["lb_cases_per_month"]);

export const ACTIVITY_COLUMNS = [
  "activity_id",
  "logged_at",
  "record_type",
  "registration_no",
  "name",
  "by",
  "channel",
  "direction",
  "outcome",
  "duration_min",
  "status_after",
  "summary",
] as const;
