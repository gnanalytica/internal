import type { ActivityEntry, ProspectRecord } from "./parse";
import { CHANNELS, ENGAGED_OUTCOMES, FOCUS_STATES, OBJECTIONS, PITCH_ANGLES, SPRINT_TARGETS, STAGES, type ProspectKind } from "./schema";

/** The slice of a record the lists, board and timeline need — kept small because every row ships to the browser. */
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
};

export const FACT_COUNT = 8;

/** How much of what the team researches is known for a record, out of FACT_COUNT. */
export function factsKnown(r: ProspectRecord): number {
  return [
    r.phone,
    r.email,
    r.lenders.length,
    r.software,
    r.casesPerMonth !== null,
    r.firmRegNo || r.people || r.keyContact,
    r.pitchAngle,
    ["A", "B", "C", "Watch"].includes(r.band),
  ].filter(Boolean).length;
}

export function toRow(r: ProspectRecord): ProspectRow {
  return {
    kind: r.kind,
    id: r.id,
    name: r.name,
    city: r.city,
    state: r.state,
    stage: r.stage,
    band: r.band,
    score: r.opportunityScore,
    assigned: r.assigned,
    nextStep: r.nextStep,
    nextStepDate: r.nextStepDate,
    lastContacted: r.lastContacted,
    lenders: r.lenders.length,
    cases: r.casesPerMonth,
    software: r.software,
    hasPhone: Boolean(r.phone),
    hasEmail: Boolean(r.email),
    researchStatus: r.researchStatus,
    pitchAngle: r.pitchAngle,
    objections: r.objections,
    facts: factsKnown(r),
  };
}

export function inFocus(r: { state: string; kind: ProspectKind }): boolean {
  return r.kind !== "valuer" || (FOCUS_STATES as readonly string[]).includes(r.state);
}

/** Today in India, as yyyy-mm-dd. */
export function todayIST(now = Date.now()): string {
  return new Date(now + 5.5 * 3600_000).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
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

/** Closed records carry no follow-ups. */
export const isOpen = (r: { stage: number }) => r.stage < 5;

/** `assigned` holds a person's name as the team types it: match the full name or the first name, any case. */
export function isAssignedTo(assigned: string, person: string): boolean {
  const a = assigned.trim().toLowerCase();
  const p = person.trim().toLowerCase();
  if (!a || !p) return false;
  return a === p || a === p.split(/\s+/)[0] || a.split(/\s+/)[0] === p.split(/\s+/)[0];
}

export type Period = "week" | "month" | "all";

export function inPeriod(date: string | null, period: Period, today: string): boolean {
  if (period === "all") return true;
  if (!date) return false;
  const d = daysBetween(date, today);
  return d >= 0 && d < (period === "week" ? 7 : 30);
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

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

/**
 * Everything the Overview tab shows, from the rows in scope and the Activity
 * log. `person` narrows it to one team member ("Me"); `team` is everyone the
 * workspace has plus anyone named in `assigned`.
 */
export function buildOverview(input: {
  rows: ProspectRow[];
  activity: ActivityEntry[];
  today: string;
  period: Period;
  person?: string | null;
  team: string[];
}): Overview {
  const { today, period } = input;
  const mine = (assigned: string) => !input.person || isAssignedTo(assigned, input.person);
  const rows = input.rows.filter((r) => mine(r.assigned));
  const ids = new Set(input.rows.map((r) => r.id));
  const acts = input.activity.filter((a) => ids.has(a.registrationNo) && inPeriod(a.date, period, today) && (!input.person || isAssignedTo(a.by, input.person)));
  const outbound = acts.filter((a) => a.direction !== "Inbound");

  const counts = STAGES.map((_, i) => rows.filter((r) => r.stage === i).length);
  const reached = (i: number) => counts.slice(i, 6).reduce((a, b) => a + b, 0);

  const channels = CHANNELS.filter((c) => c !== "Other").map((channel) => {
    const out = outbound.filter((a) => a.channel === channel);
    const engaged = acts.filter((a) => a.channel === channel && ENGAGED_OUTCOMES.has(a.outcome)).length;
    return { channel, outbound: out.length, engaged, rate: pct(engaged, out.length) };
  });
  const calls = acts.filter((a) => a.channel === "Call");
  const timed = calls.filter((a) => a.durationMin !== null);

  const valuers = rows.filter((r) => r.kind === "valuer");
  const sprint = SPRINT_TARGETS.map((s) => {
    const inList = valuers.filter((r) => ("city" in s.match ? r.city === s.match.city : r.state === s.match.state));
    return { label: s.label, inList: inList.length, contacted: inList.filter((r) => r.stage >= 1).length, target: s.target };
  });
  const top = valuers.filter((r) => r.band === "A").sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 25);

  const pitch = PITCH_ANGLES.map((angle) => {
    const discovered = rows.filter((r) => r.pitchAngle === angle && r.stage >= 2 && r.stage !== 6).length;
    const demoed = rows.filter((r) => r.pitchAngle === angle && r.stage >= 3 && r.stage !== 6).length;
    return { angle, discovered, demoed, rate: pct(demoed, discovered) };
  });

  const n = rows.length;
  const coverage = [
    { label: "Phone", count: rows.filter((r) => r.hasPhone).length },
    { label: "Email", count: rows.filter((r) => r.hasEmail).length },
    { label: "Lenders", count: rows.filter((r) => r.lenders > 0).length },
    { label: "Current software", count: rows.filter((r) => r.software).length },
    { label: "Case volume", count: rows.filter((r) => r.cases !== null).length },
    { label: "Scored (all 8)", count: rows.filter((r) => ["A", "B", "C", "Watch"].includes(r.band)).length },
    { label: "Reviewed", count: rows.filter((r) => r.researchStatus === "Reviewed").length },
  ].map((c) => ({ ...c, pct: pct(c.count, n) }));

  const researchLabel = (s: string) => (!s ? "Not started" : s.startsWith("Profiling") ? "Profiling" : s);
  const research = ["Not started", "Profiling", "Profiled", "Scored — needs review", "Reviewed", "Needs a person"].map((label) => ({
    label,
    count: rows.filter((r) => researchLabel(r.researchStatus) === label).length,
  }));

  const objections = [...new Set([...OBJECTIONS, ...rows.map((r) => r.objections).filter(Boolean)])]
    .map((objection) => ({ objection, count: rows.filter((r) => r.objections === objection).length }))
    .filter((o) => o.count > 0)
    .sort((a, b) => b.count - a.count);

  const people = [...new Set([...input.team, ...input.rows.map((r) => r.assigned).filter(Boolean)])];
  const team = people
    .map((person) => {
      const theirs = input.rows.filter((r) => isAssignedTo(r.assigned, person));
      const their = input.activity.filter((a) => ids.has(a.registrationNo) && inPeriod(a.date, period, today) && isAssignedTo(a.by, person));
      const out = their.filter((a) => a.direction !== "Inbound");
      return {
        person,
        assigned: theirs.length,
        touches: their.length,
        calls: their.filter((a) => a.channel === "Call").length,
        engagedRate: pct(their.filter((a) => ENGAGED_OUTCOMES.has(a.outcome)).length, out.length),
        overdue: theirs.filter((r) => isOpen(r) && dueBucket(r.nextStepDate, today) === "overdue").length,
        demos: theirs.filter((r) => r.stage === 3).length,
        pilots: theirs.filter((r) => r.stage === 4).length,
      };
    })
    .filter((t) => t.assigned || t.touches)
    // Merge duplicates created by "Sandeep" vs "Sandeep Kumar" in the sheet.
    .filter((t, i, all) => all.findIndex((o) => isAssignedTo(o.person, t.person)) === i)
    .sort((a, b) => b.assigned - a.assigned);

  return {
    total: n,
    kpis: {
      touches: acts.length,
      engagedRate: pct(acts.filter((a) => ENGAGED_OUTCOMES.has(a.outcome)).length, outbound.length),
      dueToday: rows.filter((r) => isOpen(r) && dueBucket(r.nextStepDate, today) === "today").length,
      overdue: rows.filter((r) => isOpen(r) && dueBucket(r.nextStepDate, today) === "overdue").length,
      demosBooked: acts.filter((a) => a.outcome === "Demo booked").length,
      pilots: counts[4],
      won: counts[5],
    },
    funnel: STAGES.map((stage, i) => ({ stage, count: counts[i], movedOn: i >= 1 && i <= 4 ? pct(reached(i + 1), reached(i)) : null })),
    channels,
    calls: { count: calls.length, avgMinutes: timed.length ? Math.round((timed.reduce((s, a) => s + (a.durationMin ?? 0), 0) / timed.length) * 10) / 10 : null },
    sprint,
    top25: { contacted: top.filter((r) => r.stage >= 1).length, size: top.length },
    pitch,
    coverage,
    research,
    objections,
    team,
    unassignedA: rows
      .filter((r) => r.band === "A" && !r.assigned && r.stage === 0)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 6),
    hasActivity: input.activity.length > 0,
  };
}

/** A person's queue for today: follow-ups due or overdue, then A-band valuers of theirs nobody has contacted. */
export function myTasks(rows: ProspectRow[], person: string, today: string): { row: ProspectRow; reason: "overdue" | "today" | "new" }[] {
  const theirs = rows.filter((r) => isAssignedTo(r.assigned, person) && isOpen(r));
  const due = theirs
    .filter((r) => ["overdue", "today"].includes(dueBucket(r.nextStepDate, today)))
    .sort((a, b) => (a.nextStepDate ?? "").localeCompare(b.nextStepDate ?? "") || (b.score ?? 0) - (a.score ?? 0))
    .map((row) => ({ row, reason: dueBucket(row.nextStepDate, today) as "overdue" | "today" }));
  const fresh = theirs
    .filter((r) => r.stage === 0 && !r.nextStepDate && r.band === "A")
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 10)
    .map((row) => ({ row, reason: "new" as const }));
  return [...due, ...fresh];
}

export type SavedView = { id: string; label: string; test: (r: ProspectRow, ctx: { person: string; today: string }) => boolean; chips: string[] };

export const SAVED_VIEWS: SavedView[] = [
  { id: "all", label: "All", test: () => true, chips: [] },
  { id: "mine", label: "Mine", test: (r, c) => isAssignedTo(r.assigned, c.person), chips: ["Assigned to me"] },
  { id: "a-new", label: "A-band, not contacted", test: (r) => r.band === "A" && r.stage === 0, chips: ["Band: A", "Status: Not contacted"] },
  { id: "due", label: "Due this week", test: (r, c) => isOpen(r) && ["overdue", "today", "soon"].includes(dueBucket(r.nextStepDate, c.today)), chips: ["Next step: within 7 days"] },
  { id: "overdue", label: "Overdue", test: (r, c) => isOpen(r) && dueBucket(r.nextStepDate, c.today) === "overdue", chips: ["Next step: overdue"] },
  { id: "review", label: "Needs review", test: (r) => r.researchStatus === "Scored — needs review", chips: ["Research: Scored — needs review"] },
  { id: "gaps", label: "Missing facts", test: (r) => r.facts < 5, chips: [`Facts known: under 5 of ${FACT_COUNT}`] },
  { id: "unassigned", label: "Unassigned", test: (r) => !r.assigned && isOpen(r), chips: ["Assigned: nobody"] },
];
