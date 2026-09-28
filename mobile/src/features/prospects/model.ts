// The prospects rules the phone needs, copied from the web's
// src/lib/prospects/{schema,stats,parse}.ts and log-touch-dialog.tsx. Kept free
// of React Native and of "@/" imports so the web's test suite can import this
// file and assert the two copies still agree (src/lib/prospects/mobile-parity.test.ts).

export const PROSPECT_KINDS = ["valuer", "firm", "rvo", "panel", "bank"] as const;
export type ProspectKind = (typeof PROSPECT_KINDS)[number];

export const KIND_LABEL: Record<ProspectKind, { one: string; many: string }> = {
  valuer: { one: "Registered valuer", many: "Valuers" },
  firm: { one: "Valuer firm", many: "Firms" },
  rvo: { one: "RVO", many: "RVOs" },
  panel: { one: "Bank panel valuer", many: "Panel valuers" },
  bank: { one: "Bank contact", many: "Bank contacts" },
};

/** Tabs with no scoring or research-fact columns; the score band and facts meter don't apply. */
export const UNSCORED_KINDS: ReadonlySet<ProspectKind> = new Set(["panel", "bank"]);

export const STAGES = ["Not contacted", "Contacted", "Discovery done", "Demo done", "Pilot running", "Won", "Lost"] as const;
export type Stage = (typeof STAGES)[number];

export const PITCH_ANGLES = ["Faster reports", "Documents read for you", "Defensible evidence", "Site visit & photos", "Team & case tracking", "Portal checks"] as const;

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
export type Direction = (typeof DIRECTIONS)[number];

export const OUTCOMES = ["Sent", "Replied", "Connected", "No answer", "Busy — call back", "Wrong number", "Not interested", "Demo booked", "Meeting held"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const DISQUALIFY_REASONS = ["Registration suspended", "Works for a lender or competitor", "Asked not to be contacted", "Not practising L&B", "Excluded by us"] as const;

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

/** Columns the app may write, per tab — the web's allow-list. The server enforces it again. */
export const WRITABLE: Record<ProspectKind, ReadonlySet<string>> = {
  valuer: new Set(["status", "city", "phone", "lenders_empanelled_with", "current_software", "lb_cases_per_month", "assigned", "outreach_route", "last_contacted", "next_step", "next_step_date", "draft_email", "draft_whatsapp", "draft_call", "draft_meeting", "notes", "research_notes", "disqualified", "research_status", "pitch_angle", "objections", "referred_by"]),
  firm: new Set(["status", "disqualified", "assigned", "key_contact", "last_contacted", "next_step", "next_step_date", "notes", "research_notes", "pitch_angle", "objections", "referred_by"]),
  rvo: new Set(["status", "assigned", "outreach_route", "last_contacted", "next_step", "next_step_date", "draft_email", "draft_whatsapp", "draft_call", "draft_meeting", "notes", "research_notes"]),
  panel: new Set(["status", "city", "phone", "email", "lenders_empanelled_with", "assigned", "outreach_route", "last_contacted", "next_step", "next_step_date", "draft_whatsapp", "draft_call", "notes", "research_notes", "disqualified"]),
  bank: new Set(["status", "contact_person", "designation", "phone", "email", "assigned", "last_contacted", "next_step", "next_step_date", "notes", "research_notes"]),
};

export const FACT_COUNT = 8;

/** The slim list row (web: ProspectRow in stats.ts). */
export type ProspectRow = {
  kind: ProspectKind;
  id: string;
  name: string;
  city: string;
  state: string;
  stage: number;
  band: string;
  score: number | null;
  assigned: string;
  nextStep: string;
  nextStepDate: string | null;
  lastContacted: string | null;
  lenders: number;
  cases: number | null;
  software: string;
  hasPhone: boolean;
  hasEmail: boolean;
  researchStatus: string;
  pitchAngle: string;
  objections: string;
  facts: number;
  doNotContact: boolean;
};

export type Drafts = { email: string; whatsapp: string; call: string; meeting: string };

/** The full record (web: ProspectRecord in parse.ts). */
export type ProspectRecord = {
  kind: ProspectKind;
  id: string;
  name: string;
  status: string;
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
  lastContacted: string | null;
  nextStep: string;
  nextStepDate: string | null;
  drafts: Drafts;
  notes: string;
  scores: (number | null)[];
  switchingBarrier: number | null;
  disqualified: string;
  opportunityScore: number | null;
  band: string;
  bandLabel: string;
  scoreReason: string;
  scoreGaps: string;
  researchStatus: string;
  researchSources: { what: string; url: string }[];
  researchNotes: string;
  lastResearched: string | null;
  pitchAngle: string;
  objections: string;
  referredBy: string;
  practice: string;
  bank: { institution: string; type: string; office: string; department: string; contactPerson: string; designation: string; empanelmentPage: string; empanelmentWindow: string; howToReach: string };
};

export type ActivityEntry = {
  id: string;
  loggedAt: string;
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

export type Period = "week" | "month" | "all";

/** The Overview endpoint's body (web: Overview in stats.ts). */
export type Overview = {
  total: number;
  kpis: { touches: number; engagedRate: number; dueToday: number; overdue: number; demosBooked: number; pilots: number; won: number };
  funnel: { stage: string; count: number; movedOn: number | null }[];
  channels: { channel: string; outbound: number; engaged: number; rate: number }[];
  calls: { count: number; avgMinutes: number | null };
  sprint: { label: string; inList: number; contacted: number; target: number }[];
  top25: { contacted: number; size: number };
  pitch: { angle: string; discovered: number; demoed: number; rate: number }[];
  coverage: { label: string; count: number; pct: number }[];
  research: { label: string; count: number }[];
  objections: { objection: string; count: number }[];
  team: { person: string; assigned: number; touches: number; calls: number; engagedRate: number; overdue: number; demos: number; pilots: number }[];
  unassignedA: ProspectRow[];
  hasActivity: boolean;
};

/** One task in "My work" (web: MyWorkItem in views.ts). */
export type MyWorkItem = {
  reason: "overdue" | "today" | "new";
  row: ProspectRow;
  drafts: Drafts;
  phone: string;
  email: string;
  pitchAngle: string;
  lenders: number;
  casesPerMonth: number | null;
  software: string;
};

// ---- dates -----------------------------------------------------------------

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

/** Today in India, as yyyy-mm-dd. The server's `today` wins when there is one. */
export function todayIST(now = Date.now()): string {
  return new Date(now + 5.5 * 3600_000).toISOString().slice(0, 10);
}

/** ISO yyyy-mm-dd → dd-mm-yyyy, the sheet's display format. */
export function displayDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

export type Due = "overdue" | "today" | "soon" | "later" | "none";

export function dueBucket(nextStepDate: string | null, today: string): Due {
  if (!nextStepDate) return "none";
  const d = daysBetween(today, nextStepDate);
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  if (d <= 7) return "soon";
  return "later";
}

export function dueText(date: string | null, today: string): string {
  const b = dueBucket(date, today);
  if (b === "none") return "No date";
  if (b === "today") return "Today";
  if (b === "overdue") return `Overdue · ${displayDate(date)}`;
  return displayDate(date);
}

// ---- people and queues ---------------------------------------------------------

/** Closed records carry no follow-ups. */
export const isOpen = (r: { stage: number }) => r.stage < 5;

/** `assigned` holds a person's name as the team types it: match the full name or the first name, any case. */
export function isAssignedTo(assigned: string, person: string): boolean {
  const a = assigned.trim().toLowerCase();
  const p = person.trim().toLowerCase();
  if (!a || !p) return false;
  return a === p || a === p.split(/\s+/)[0] || a.split(/\s+/)[0] === p.split(/\s+/)[0];
}

export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? "";

export type SavedView = { id: string; label: string; test: (r: ProspectRow, ctx: { person: string; today: string }) => boolean; chips: string[] };

export const SAVED_VIEWS: SavedView[] = [
  { id: "all", label: "All", test: () => true, chips: [] },
  { id: "mine", label: "Mine", test: (r, c) => isAssignedTo(r.assigned, c.person), chips: ["Assigned to me"] },
  { id: "a-new", label: "A-band, not contacted", test: (r) => r.band === "A" && r.stage === 0 && !r.doNotContact, chips: ["Band: A", "Status: Not contacted"] },
  { id: "due", label: "Due this week", test: (r, c) => isOpen(r) && ["overdue", "today", "soon"].includes(dueBucket(r.nextStepDate, c.today)), chips: ["Next step: within 7 days"] },
  { id: "overdue", label: "Overdue", test: (r, c) => isOpen(r) && dueBucket(r.nextStepDate, c.today) === "overdue", chips: ["Next step: overdue"] },
  { id: "review", label: "Needs review", test: (r) => r.researchStatus === "Scored — needs review", chips: ["Research: Scored — needs review"] },
  { id: "gaps", label: "Missing facts", test: (r) => r.facts < 5, chips: [`Facts known: under 5 of ${FACT_COUNT}`] },
  { id: "unassigned", label: "Unassigned", test: (r) => !r.assigned && isOpen(r), chips: ["Assigned: nobody"] },
];

export const BANDS = ["A", "B", "C", "Watch", "Incomplete", "Disqualified"] as const;

/** Owner: "" everyone, "me", "none", or a person's name. Band: "" any. Stage: null any. */
export type Filters = { owner: string; band: string; q: string; stage: number | null };
export const NO_FILTERS: Filters = { owner: "", band: "", q: "", stage: null };

/** The web's list filters (pipeline.tsx applyFilters) plus its status select. */
export function applyFilters(rows: ProspectRow[], f: Filters, me: string): ProspectRow[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.owner === "me" && !isAssignedTo(r.assigned, me)) return false;
    if (f.owner === "none" && r.assigned) return false;
    if (f.owner && !["me", "none"].includes(f.owner) && !isAssignedTo(r.assigned, f.owner)) return false;
    if (f.band && r.band !== f.band) return false;
    if (f.stage !== null && r.stage !== f.stage) return false;
    if (q && !`${r.name} ${r.id} ${r.city} ${r.state}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** The list's order: highest score first, then by name. */
export const byScore = (a: ProspectRow, b: ProspectRow) => (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name);

/** The board's order within a stage: overdue first, then highest score. */
export function byUrgency(today: string) {
  const rank = (r: ProspectRow) => ({ overdue: 0, today: 1, soon: 2, later: 3, none: 4 })[dueBucket(r.nextStepDate, today)];
  return (a: ProspectRow, b: ProspectRow) => rank(a) - rank(b) || (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name);
}

// ---- logging a touch -------------------------------------------------------------

/** Where an outcome usually leaves a record — a default the caller can change. */
export function defaultStage(stage: number, channel: Channel, outcome: Outcome): number {
  if (outcome === "Not interested") return 6;
  if (outcome === "Demo booked" || outcome === "Meeting held") return Math.max(stage, 2);
  if (outcome === "Connected" && (channel === "Call" || channel === "Meeting")) return Math.max(stage, 2);
  return Math.max(stage, 1);
}

export function defaultNextStep(outcome: Outcome, current: string): string {
  if (outcome === "Demo booked") return "Run the demo";
  if (outcome === "No answer" || outcome === "Busy — call back") return "Try again on another channel";
  if (outcome === "Sent") return "Follow up if no reply";
  if (outcome === "Not interested") return "";
  return current || "Follow up";
}

export const FOLLOW_UPS = [
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "Next week", days: 7 },
  { label: "In 2 weeks", days: 14 },
  { label: "No follow-up", days: null },
] as const;

export const SOFTWARE = ["Word + Excel", "Word templates", "Own software", "Bank's portal", "Another tool"] as const;

export type Quick = { label: string; hint: string; channel: Channel; outcome: Outcome; days: number | null; nextStep: string; extra?: Record<string, string> };

/** My work's one-tap outcomes (web: my-work.tsx QUICK). */
export const QUICK: Quick[] = [
  { label: "Sent", hint: "follow up in 3 days", channel: "WhatsApp", outcome: "Sent", days: 3, nextStep: "Follow up if no reply" },
  { label: "No answer", hint: "retry tomorrow, other channel", channel: "Call", outcome: "No answer", days: 1, nextStep: "Try again on another channel" },
  { label: "Demo booked", hint: "status → Discovery done", channel: "Call", outcome: "Demo booked", days: 3, nextStep: "Run the demo" },
  { label: "Not interested", hint: "status → Lost · ask for a referral", channel: "Call", outcome: "Not interested", days: null, nextStep: "" },
  { label: "Wrong number", hint: "flags it for research", channel: "Call", outcome: "Wrong number", days: 2, nextStep: "Find a working number", extra: { research_status: "Needs a person" } },
];

/** The body POSTed to /prospects/{kind}/{id}/touch. */
export type TouchBody = {
  name: string;
  channel: Channel;
  direction: Direction;
  outcome: Outcome;
  durationMin: number | null;
  summary: string;
  statusAfter: Stage;
  nextStep: string | null;
  nextStepDate: string | null;
  fields?: { current_software?: string; lb_cases_per_month?: number; objections?: string; pitch_angle?: string; referred_by?: string };
};

/** A one-tap outcome as the web's My work logs it. */
export function quickTouch(q: Quick, row: { name: string; stage: number }, today: string): TouchBody {
  return {
    name: row.name,
    channel: q.channel,
    direction: "Outbound",
    outcome: q.outcome,
    durationMin: null,
    summary: "",
    statusAfter: STAGES[defaultStage(row.stage, q.channel, q.outcome)],
    nextStep: q.nextStep || null,
    nextStepDate: q.days === null ? null : addDays(today, q.days),
  };
}

export const DRAFT_CHANNELS = [
  { key: "whatsapp", col: "draft_whatsapp", label: "WhatsApp", channel: "WhatsApp" },
  { key: "email", col: "draft_email", label: "Email", channel: "Email" },
  { key: "call", col: "draft_call", label: "Call", channel: "Call" },
  { key: "meeting", col: "draft_meeting", label: "Meeting", channel: "Meeting" },
] as const satisfies readonly { key: keyof Drafts; col: string; label: string; channel: Channel }[];
export type DraftKey = (typeof DRAFT_CHANNELS)[number]["key"];

/** Marking a draft as sent/done, as the web's record panel logs it. */
export function markSentTouch(key: DraftKey, r: { name: string; stage: number; nextStep: string }, today: string): TouchBody {
  const ch = DRAFT_CHANNELS.find((c) => c.key === key)!;
  return {
    name: r.name,
    channel: ch.channel,
    direction: "Outbound",
    outcome: key === "call" || key === "meeting" ? "Connected" : "Sent",
    durationMin: null,
    summary: "",
    statusAfter: STAGES[Math.max(r.stage, 1)],
    nextStep: r.nextStep || "Follow up",
    nextStepDate: addDays(today, 3),
  };
}

// ---- reaching someone -------------------------------------------------------------

/** The last ten digits of an Indian number, or null when there aren't ten. */
export function digits10(phone: string): string | null {
  const d = phone.replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
}

/** An email draft is "Subject: …" then a blank line then the body. */
export function emailParts(draft: string): { subject: string; body: string } {
  const m = draft.match(/^Subject:\s*(.+)\n+([\s\S]*)$/);
  return m ? { subject: m[1].trim(), body: m[2].trim() } : { subject: "", body: draft };
}

export function telHref(phone: string): string | null {
  const d = digits10(phone);
  return d ? `tel:+91${d}` : null;
}

export function whatsappHref(phone: string, text: string): string | null {
  const d = digits10(phone);
  return d ? `https://wa.me/91${d}${text ? `?text=${encodeURIComponent(text)}` : ""}` : null;
}

export function mailtoHref(email: string, draft: string): string | null {
  if (!email) return null;
  const { subject, body } = emailParts(draft);
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// ---- research ---------------------------------------------------------------------

/** `research_notes`: one fact per line, each "label: text"; a line without a label stays whole. */
export function parseNoteLines(v: string): { label: string; text: string }[] {
  return v
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.startsWith("- ")) return { label: "", text: line };
      const m = line.match(/^([^:]{1,48}):\s+(\S.*)$/);
      return m && !/^https?$/i.test(m[1]) ? { label: m[1].trim(), text: m[2].trim() } : { label: "", text: line };
    });
}

/** A record the team must not reach out to. Research writes this as the first line of research_notes. */
export function isDoNotContact(researchNotes: string): boolean {
  return /^\s*DO NOT CONTACT\b/i.test(researchNotes);
}

/** How much of what the team researches is known for a record, out of FACT_COUNT. */
export function factsKnown(r: ProspectRecord): number {
  return [r.phone, r.email, r.lenders.length, r.software, r.casesPerMonth !== null, r.firmRegNo || r.people || r.keyContact, r.pitchAngle, ["A", "B", "C", "Watch"].includes(r.band)].filter(Boolean).length;
}

/** Whether a stage's "fill before moving on" column has a value on this record. */
export function fieldFilled(r: ProspectRecord, col: string): boolean {
  const map: Record<string, unknown> = {
    phone: r.phone,
    pitch_angle: r.pitchAngle,
    draft_whatsapp: r.drafts.whatsapp,
    last_contacted: r.lastContacted,
    next_step_date: r.nextStepDate,
    next_step: r.nextStep,
    lb_cases_per_month: r.casesPerMonth,
    current_software: r.software,
    objections: r.objections,
    notes: r.notes,
    referred_by: r.referredBy,
  };
  const v = map[col];
  return v !== null && v !== undefined && v !== "";
}
