/**
 * The Analytics weekly scorecard. Pure — no I/O — so the week maths, the auto
 * sources and the status read can all be tested on their own.
 *
 * A metric's number for a week either comes from a `metric_points` row typed
 * in on the scorecard (source "manual") or is counted by the app at read time
 * from data it already holds (an auto source). Auto values are never stored.
 *
 * Weeks run Monday to Sunday, India time, and a week is named by its Monday as
 * yyyy-mm-dd. A typed-in number is stored at that Monday, 00:00 UTC — the same
 * instant `addMetricPoint` gives a yyyy-mm-dd — which falls inside the week in
 * India time.
 */

import { readTarget, type TargetDirection } from "@/lib/metrics";
import { STAGES } from "@/lib/prospects/schema";

// ---- Week maths (Monday start, Asia/Kolkata) ----

const IST_MS = 5.5 * 3600_000;
const DAY_MS = 86_400_000;

/** The India-time calendar day of an instant, as yyyy-mm-dd. */
export function istDay(t: Date | string | number): string {
  const ms = t instanceof Date ? t.getTime() : typeof t === "number" ? t : Date.parse(t);
  return new Date(ms + IST_MS).toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** The Monday on or before a calendar day. */
export function mondayOf(day: string): string {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}

/** The week (its Monday) an instant falls in, India time. */
export function weekOf(t: Date | string | number): string {
  return mondayOf(istDay(t));
}

export function isMonday(day: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00Z`)) && mondayOf(day) === day;
}

/** The instants a week covers: Monday 00:00 India time, up to (not including) the next Monday's. */
export function weekBounds(monday: string): { from: Date; to: Date } {
  const from = Date.parse(`${monday}T00:00:00Z`) - IST_MS;
  return { from: new Date(from), to: new Date(from + 7 * DAY_MS) };
}

/** Where a typed-in number for a week is stored. */
export function weekPeriodDate(monday: string): Date {
  return new Date(`${monday}T00:00:00Z`);
}

/** The last `count` weeks, oldest first, ending with the week `now` is in. */
export function scorecardWeeks(now: Date | number, count = 5): string[] {
  const current = weekOf(now);
  return Array.from({ length: count }, (_, i) => addDays(current, (i - count + 1) * 7));
}

/** "9 Nov" — a week's column header. */
export function weekLabel(monday: string): string {
  return new Date(`${monday}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

// ---- Areas and sources ----

export const SCORECARD_AREAS = [
  { id: "sales", label: "Sales", from: "counted from Prospects and Deals" },
  { id: "marketing", label: "Marketing", from: "counted from the content calendar" },
  { id: "product", label: "Product", from: "you type these in" },
  { id: "reliability", label: "Reliability", from: "Engineering tickets and uptime" },
] as const;
export type ScorecardArea = (typeof SCORECARD_AREAS)[number]["id"];
export const isScorecardArea = (v: string): v is ScorecardArea => SCORECARD_AREAS.some((a) => a.id === v);

type AutoSourceDef = {
  label: string;
  area: ScorecardArea;
  /** "week": a count of what happened that week. "total": a running total as the week closed. */
  kind: "week" | "total";
  /** How it is counted, in a sentence, for the source picker and the cell's title. */
  how: string;
};

export const AUTO_SOURCES = {
  "sales.touches": { label: "Touches logged", area: "sales", kind: "week", how: "Touches logged in the Prospects activity that week." },
  "sales.demos": { label: "Demos done", area: "sales", kind: "week", how: "Prospects a logged touch first moved to Demo done (or further) that week." },
  "sales.launchReady": { label: "Launch-ready leads", area: "sales", kind: "total", how: "Prospects at Pilot running or Won." },
  "sales.dealsWon": { label: "Deals won", area: "sales", kind: "total", how: "This project's deals at Won." },
  "marketing.posted": { label: "Pieces posted", area: "marketing", kind: "week", how: "Content calendar pieces published that week." },
  "reliability.openDefects": { label: "Open P0 / P1 defects", area: "reliability", kind: "total", how: "Open urgent or high priority tasks labelled bug or defect." },
} as const satisfies Record<string, AutoSourceDef>;

export type AutoSourceKey = keyof typeof AUTO_SOURCES;
export type MetricSource = "manual" | AutoSourceKey;
export const AUTO_SOURCE_KEYS = Object.keys(AUTO_SOURCES) as AutoSourceKey[];
export const isAutoSource = (v: string): v is AutoSourceKey => Object.hasOwn(AUTO_SOURCES, v);
export const isMetricSource = (v: string): v is MetricSource => v === "manual" || isAutoSource(v);

// ---- What the auto sources count from ----

/** Prospects-sheet facts the sales sources need. */
export type ProspectSignals = {
  /** Logged touches: the prospect, the India-time day, the stage it left them at (null when blank or unrecognised). */
  touches: { key: string; date: string; stageAfter: number | null }[];
  /** Every prospect's current stage (index into STAGES). */
  stages: number[];
};

/** Project facts from the database the other sources need; instants are ISO strings. */
export type ScorecardSignals = {
  /** Deals at Won. `wonAt` is when the deal was last updated — the closest the schema has to a win date. */
  dealsWon: { wonAt: string }[];
  /** Content pieces published, with their publish date. */
  published: { publishDate: string }[];
  /**
   * Urgent/high tasks that count as defects, open or closed, or null when the
   * project has none labelled at all — then "0 open" can't be told from "not
   * tracked", so the number is left blank rather than reading as on track.
   */
  defects: { createdAt: string; closedAt: string | null }[] | null;
};

export const DEMO_STAGE = STAGES.indexOf("Demo done");
const PILOT_STAGE = STAGES.indexOf("Pilot running");
const WON_STAGE = STAGES.indexOf("Won");
const LOST_STAGE = STAGES.indexOf("Lost");

/** A sheet status → stage index, or null when it's blank or not a stage. */
export function stageOf(status: string): number | null {
  const s = status.trim().toLowerCase();
  if (!s) return null;
  const i = STAGES.findIndex((x) => x.toLowerCase() === s);
  return i < 0 ? null : i;
}

/**
 * The sales facts, from the prospects workbook's Activity tab and record tabs.
 * Null when the workbook has nothing in it (no sheet access, or none set up),
 * so the sales rows read "no number yet" rather than a run of zeros.
 */
export function prospectSignals(
  activity: { date: string | null; recordType: string; registrationNo: string; statusAfter: string }[],
  records: { stage: number }[],
): ProspectSignals | null {
  if (activity.length === 0 && records.length === 0) return null;
  return {
    touches: activity.flatMap((a) => (a.date ? [{ key: `${a.recordType}:${a.registrationNo}`, date: a.date, stageAfter: stageOf(a.statusAfter) }] : [])),
    stages: records.map((r) => r.stage),
  };
}

/** Touches in the order they happened: by day, then by their order in the sheet. */
function chronological(touches: ProspectSignals["touches"]) {
  return touches.map((t, i) => ({ ...t, i })).sort((a, b) => (a.date === b.date ? a.i - b.i : a.date < b.date ? -1 : 1));
}

const isLaunchReady = (stage: number) => stage === PILOT_STAGE || stage === WON_STAGE;
const pastDemo = (stage: number) => stage >= DEMO_STAGE && stage !== LOST_STAGE;

/** The instant a week closes (next Monday 00:00 India time). */
const weekEnd = (monday: string) => weekBounds(monday).to.getTime();

/**
 * One auto source's values for each week, aligned with `weeks` (oldest first,
 * the last one being this week). Null where the app has nothing to count from.
 */
export function autoValues(source: AutoSourceKey, weeks: string[], signals: ScorecardSignals, prospects: ProspectSignals | null): (number | null)[] {
  const thisWeek = weeks[weeks.length - 1];
  switch (source) {
    case "sales.touches": {
      if (!prospects) return weeks.map(() => null);
      return weeks.map((w) => prospects.touches.filter((t) => mondayOf(t.date) === w).length);
    }
    case "sales.demos": {
      // The Activity tab records the stage each touch left a prospect at, but
      // not the stage before it. A demo is counted once per prospect, in the
      // week of the first touch that left them at Demo done or further (Lost
      // aside); a prospect moved there by editing the sheet directly, with no
      // touch logged, isn't counted.
      if (!prospects) return weeks.map(() => null);
      const seen = new Set<string>();
      const firsts: string[] = [];
      for (const t of chronological(prospects.touches)) {
        if (t.stageAfter === null || !pastDemo(t.stageAfter) || seen.has(t.key)) continue;
        seen.add(t.key);
        firsts.push(mondayOf(t.date));
      }
      return weeks.map((w) => firsts.filter((f) => f === w).length);
    }
    case "sales.launchReady": {
      // This week is the sheet as it stands. Earlier weeks are rebuilt from
      // the stage each prospect's last touch before the week closed left them
      // at; a prospect moved without a touch only shows from this week on.
      if (!prospects) return weeks.map(() => null);
      const ordered = chronological(prospects.touches);
      return weeks.map((w) => {
        if (w === thisWeek) return prospects.stages.filter(isLaunchReady).length;
        const end = addDays(w, 7);
        const last = new Map<string, number>();
        for (const t of ordered) if (t.date < end && t.stageAfter !== null) last.set(t.key, t.stageAfter);
        return [...last.values()].filter(isLaunchReady).length;
      });
    }
    case "sales.dealsWon":
      return weeks.map((w) => signals.dealsWon.filter((d) => Date.parse(d.wonAt) < weekEnd(w)).length);
    case "marketing.posted":
      return weeks.map((w) => signals.published.filter((p) => weekOf(p.publishDate) === w).length);
    case "reliability.openDefects": {
      const defects = signals.defects;
      if (!defects) return weeks.map(() => null);
      return weeks.map((w) => {
        const end = weekEnd(w);
        return defects.filter((d) => Date.parse(d.createdAt) < end && (d.closedAt === null || Date.parse(d.closedAt) >= end)).length;
      });
    }
  }
}

// ---- Reading a row ----

export type ScoreStatus = "on" | "behind" | "empty" | "untargeted";

/** On track when this week's number meets the target in its direction; no target just trends. */
export function scoreStatus(value: number | null, target: number | null, direction: string): ScoreStatus {
  if (value === null) return "empty";
  if (target === null) return "untargeted";
  return readTarget(value, target, direction === "below" ? "below" : "above")?.onTrack ? "on" : "behind";
}

export type ScorecardRow = {
  id: string;
  name: string;
  unit: string | null;
  area: ScorecardArea;
  source: MetricSource;
  target: number | null;
  targetDirection: TargetDirection;
  /** One per week, oldest first; the last is this week. */
  values: (number | null)[];
};

export type ScorecardMetric = {
  id: string;
  name: string;
  unit: string | null;
  area: string;
  source: string;
  target: number | null;
  targetDirection: string;
  points: { periodDate: Date | string; value: number }[];
};

/**
 * Every metric's row for the given weeks. A typed-in week with more than one
 * point (one entered on a weekday before the scorecard existed, say) reads the
 * latest. An unknown source reads as manual and an unknown area as Product.
 */
export function buildRows(metrics: ScorecardMetric[], weeks: string[], signals: ScorecardSignals, prospects: ProspectSignals | null): ScorecardRow[] {
  return metrics.map((m) => {
    const source: MetricSource = isMetricSource(m.source) ? m.source : "manual";
    let values: (number | null)[];
    if (source === "manual") {
      const byWeek = new Map<string, { at: number; value: number }>();
      for (const p of m.points) {
        const at = new Date(p.periodDate).getTime();
        const w = weekOf(at);
        const prev = byWeek.get(w);
        if (!prev || at >= prev.at) byWeek.set(w, { at, value: p.value });
      }
      values = weeks.map((w) => byWeek.get(w)?.value ?? null);
    } else {
      values = autoValues(source, weeks, signals, prospects);
    }
    return {
      id: m.id,
      name: m.name,
      unit: m.unit,
      area: isScorecardArea(m.area) ? m.area : "product",
      source,
      target: m.target,
      targetDirection: m.targetDirection === "below" ? "below" : "above",
      values,
    };
  });
}

export function summarize(rows: { status: ScoreStatus }[]) {
  return {
    on: rows.filter((r) => r.status === "on").length,
    behind: rows.filter((r) => r.status === "behind").length,
    waiting: rows.filter((r) => r.status === "empty").length,
    total: rows.length,
  };
}

/** A scorecard number: whole numbers grouped the Indian way, fractions to two places. */
export function formatValue(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

/** A target as the scorecard writes it: "60", "≤ 30"; a zero ceiling reads simply "0". */
export function targetLabel(target: number | null, direction: string): string {
  if (target === null) return "—";
  return direction === "below" && target !== 0 ? `≤ ${formatValue(target)}` : formatValue(target);
}

/** A typed cell → a number, null for blank, or undefined when it isn't a number. */
export function parseCell(text: string): number | null | undefined {
  const s = text.replace(/[,\s₹%]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

// ---- The suggested set ----

export type SuggestedMetric = {
  name: string;
  unit: string;
  area: ScorecardArea;
  target: number | null;
  targetDirection: TargetDirection;
  source: MetricSource;
  /** Names the same metric had in the old Analytics list, so the seed adopts it rather than adding a twin. */
  formerly?: string[];
};

/** The thirteen metrics the scorecard starts with, in the order it shows them. */
export const SUGGESTED_METRICS: SuggestedMetric[] = [
  { name: "Touches logged", unit: "per week", area: "sales", target: 60, targetDirection: "above", source: "sales.touches" },
  { name: "Demos done", unit: "per week", area: "sales", target: 3, targetDirection: "above", source: "sales.demos" },
  { name: "Launch-ready leads", unit: "total", area: "sales", target: 5, targetDirection: "above", source: "sales.launchReady" },
  { name: "Deals won", unit: "total", area: "sales", target: null, targetDirection: "above", source: "sales.dealsWon" },
  { name: "Pieces posted", unit: "per week", area: "marketing", target: 8, targetDirection: "above", source: "marketing.posted" },
  { name: "WhatsApp group members", unit: "total", area: "marketing", target: 50, targetDirection: "above", source: "manual" },
  { name: "Download sign-ups", unit: "per week", area: "marketing", target: 25, targetDirection: "above", source: "manual", formerly: ["Downloadable resource captures"] },
  { name: "Extraction accuracy, key fields", unit: "%", area: "product", target: 90, targetDirection: "above", source: "manual", formerly: ["Extraction accuracy — key fields"] },
  { name: "Time to produce one report", unit: "min", area: "product", target: 30, targetDirection: "below", source: "manual" },
  { name: "AI and infra cost per report", unit: "₹", area: "product", target: 40, targetDirection: "below", source: "manual", formerly: ["AI + infra cost per report"] },
  { name: "Open P0 / P1 defects", unit: "count", area: "reliability", target: 0, targetDirection: "below", source: "reliability.openDefects" },
  { name: "Uptime", unit: "%", area: "reliability", target: 99.5, targetDirection: "above", source: "manual" },
  { name: "P0 time to fix", unit: "hours", area: "reliability", target: 4, targetDirection: "below", source: "manual", formerly: ["P0 mean time to resolve"] },
];

/** Sort keys that keep the suggested set in its own order, ahead of metrics added later (`z<time>`). */
export const suggestedSortKey = (i: number) => `s${String(i).padStart(2, "0")}`;
