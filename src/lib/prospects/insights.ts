import type { ActivityEntry } from "./parse";
import { CHANNELS, ENGAGED_OUTCOMES } from "./schema";
import { addDays, daysBetween, dueBucket, inPeriod, isAssignedTo, isOpen, type Period, type ProspectRow } from "./stats";

/**
 * The series behind the Insights charts. Pure, and filtered exactly as
 * buildOverview filters (the rows in scope, the period, "Me"), so a chart
 * never disagrees with the figure beside it: the touches columns add up to
 * the Touches KPI for the same filters.
 */

/** The channels the charts draw, in their fixed colour order. */
export const CHART_CHANNELS = CHANNELS.filter((c) => c !== "Other");
export type ChartChannel = (typeof CHART_CHANNELS)[number];

export type TouchBucket = { from: string; to: string; byChannel: Record<string, number>; total: number };

/** How an outcome went, coarsely, for the outcomes chart. Order is the stack order, best first. */
export const OUTCOME_CLASSES = ["Engaged", "Waiting", "No answer", "Closed"] as const;
export type OutcomeClass = (typeof OUTCOME_CLASSES)[number];

export function outcomeClass(outcome: string): OutcomeClass {
  if (ENGAGED_OUTCOMES.has(outcome)) return "Engaged";
  if (outcome === "No answer" || outcome === "Busy — call back") return "No answer";
  if (outcome === "Not interested" || outcome === "Wrong number") return "Closed";
  return "Waiting";
}

/** Follow-up state of a contacted, open prospect, in the order the bar shows them. */
export const FOLLOW_UP_PARTS = ["Overdue", "Due today", "Next 7 days", "Later", "No date"] as const;
export type FollowUpPart = (typeof FOLLOW_UP_PARTS)[number];

/** Days since the last touch, for contacted open prospects. */
export const STALE_BUCKETS = [
  { label: "0–7", max: 7 },
  { label: "8–14", max: 14 },
  { label: "15–30", max: 30 },
  { label: "31–60", max: 60 },
  { label: "60+", max: Infinity },
] as const;

export type InsightCharts = {
  /** Touches per day (per week for spans over 31 days); null for "Today", where one column isn't a chart. */
  touches: { unit: "day" | "week"; buckets: TouchBucket[] } | null;
  /** Each channel's touches split by how they went; channels with none are left out. */
  outcomes: { channel: string; total: number; byClass: Record<OutcomeClass, number> }[];
  /** Now: contacted prospects that are still open, by follow-up state. */
  followUp: { part: FollowUpPart; count: number }[];
  /** Now: contacted open prospects by days since last contact. */
  staleness: { label: string; count: number }[];
};

/** The first and last day a period covers, for bucketing. "all" starts at the first touch logged. */
function periodDays(period: Period, today: string, acts: ActivityEntry[]): { from: string; to: string } | null {
  if (typeof period === "object") return { from: period.from, to: period.to };
  if (period === "today") return null;
  if (period === "all") {
    const first = acts.map((a) => a.date).filter((d): d is string => Boolean(d)).sort()[0];
    return first ? { from: first, to: today } : null;
  }
  return { from: addDays(today, period === "week" ? -6 : -29), to: today };
}

export function buildInsightCharts(input: { rows: ProspectRow[]; activity: ActivityEntry[]; today: string; period: Period; person?: string | null }): InsightCharts {
  const { today, period } = input;
  const ids = new Set(input.rows.map((r) => r.id));
  const acts = input.activity.filter((a) => a.date && ids.has(a.registrationNo) && inPeriod(a.date, period, today) && (!input.person || isAssignedTo(a.by, input.person)));
  const rows = input.rows.filter((r) => !input.person || isAssignedTo(r.assigned, input.person));

  let touches: InsightCharts["touches"] = null;
  const span = periodDays(period, today, acts);
  if (span) {
    const days = daysBetween(span.from, span.to) + 1;
    const unit = days > 31 ? "week" : "day";
    const step = unit === "week" ? 7 : 1;
    const buckets: TouchBucket[] = [];
    for (let d = span.from; d <= span.to; d = addDays(d, step)) {
      const to = addDays(d, step - 1) < span.to ? addDays(d, step - 1) : span.to;
      const inBucket = acts.filter((a) => a.date! >= d && a.date! <= to);
      const byChannel = Object.fromEntries(CHART_CHANNELS.map((c) => [c, inBucket.filter((a) => a.channel === c).length]));
      // A touch on "Other" counts in the total (it is in the Touches KPI) but isn't drawn as its own colour.
      buckets.push({ from: d, to, byChannel, total: inBucket.length });
    }
    touches = { unit, buckets };
  }

  const outcomes = [...CHART_CHANNELS, "Other"]
    .map((channel) => {
      const mine = acts.filter((a) => a.channel === channel);
      const byClass = Object.fromEntries(OUTCOME_CLASSES.map((k) => [k, mine.filter((a) => outcomeClass(a.outcome) === k).length])) as Record<OutcomeClass, number>;
      return { channel, total: mine.length, byClass };
    })
    .filter((o) => o.total > 0);

  const contacted = rows.filter((r) => isOpen(r) && r.stage >= 1);
  const partOf = (r: ProspectRow): FollowUpPart => ({ overdue: "Overdue", today: "Due today", soon: "Next 7 days", later: "Later", none: "No date" } as const)[dueBucket(r.nextStepDate, today)];
  const followUp = FOLLOW_UP_PARTS.map((part) => ({ part, count: contacted.filter((r) => partOf(r) === part).length }));

  const touched = contacted.filter((r) => r.lastContacted);
  const staleness = STALE_BUCKETS.map((b, i) => ({
    label: b.label,
    count: touched.filter((r) => {
      const d = daysBetween(r.lastContacted!, today);
      const min = i === 0 ? -Infinity : STALE_BUCKETS[i - 1].max;
      return d > min && d <= b.max;
    }).length,
  }));

  return { touches, outcomes, followUp, staleness };
}
