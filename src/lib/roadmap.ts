export type DateInput = Date | string | null | undefined;

export type RoadmapRange = {
  start: Date;
  end: Date; // exclusive
  months: Date[];
};

const DAY = 24 * 60 * 60 * 1000;

function toDate(d: DateInput): Date | null {
  if (!d) return null;
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? null : x;
}

export function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

function monthCount(start: Date, end: Date): number {
  return (
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth())
  );
}

/** Compute the month grid spanning all item dates, with a minimum span. */
export function computeRange(
  items: { startDate?: DateInput; targetDate?: DateInput }[],
  today: Date,
  minMonths = 4,
): RoadmapRange {
  const dates: Date[] = [];
  for (const i of items) {
    const s = toDate(i.startDate);
    const t = toDate(i.targetDate);
    if (s) dates.push(s);
    if (t) dates.push(t);
  }

  let start: Date;
  let end: Date;
  if (dates.length === 0) {
    start = startOfMonth(today);
    end = addMonths(start, minMonths);
  } else {
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    start = startOfMonth(min);
    end = addMonths(startOfMonth(max), 1); // include the whole max month
    while (monthCount(start, end) < minMonths) end = addMonths(end, 1);
  }

  const months: Date[] = [];
  let cur = start;
  while (cur < end) {
    months.push(cur);
    cur = addMonths(cur, 1);
  }
  return { start, end, months };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Position a bar within the range. If only one date is set, assume a 2-week
 * span around it. Returns null when neither date is set.
 */
export function barMetrics(
  item: { startDate?: DateInput; targetDate?: DateInput },
  range: RoadmapRange,
): { leftPct: number; widthPct: number } | null {
  let s = toDate(item.startDate);
  let t = toDate(item.targetDate);
  if (!s && !t) return null;
  if (s && !t) t = new Date(s.getTime() + 14 * DAY);
  if (t && !s) s = new Date(t.getTime() - 14 * DAY);

  const total = range.end.getTime() - range.start.getTime();
  const left = clamp01((s!.getTime() - range.start.getTime()) / total);
  const right = clamp01((t!.getTime() - range.start.getTime()) / total);
  const width = Math.max(right - left, 0.01); // keep a sliver visible
  return { leftPct: left * 100, widthPct: width * 100 };
}

/** Fractional position (0–1) of `today` within the range, or null if outside. */
export function todayOffset(range: RoadmapRange, today: Date): number | null {
  const total = range.end.getTime() - range.start.getTime();
  const off = (today.getTime() - range.start.getTime()) / total;
  return off >= 0 && off <= 1 ? off : null;
}

export function monthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

export function quarterLabel(d: Date): string {
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  const yy = String(d.getUTCFullYear()).slice(2);
  return `Q${q} '${yy}`;
}

/**
 * Group a range's months into quarter columns for the timeline header, each
 * positioned as a percentage of the whole range (so bars from barMetrics line
 * up). Reuses the month grid already computed by computeRange.
 */
export function quartersForRange(
  range: RoadmapRange,
): { label: string; leftPct: number; widthPct: number }[] {
  const total = range.end.getTime() - range.start.getTime();
  const out: { label: string; leftPct: number; widthPct: number }[] = [];
  for (const m of range.months) {
    const label = quarterLabel(m);
    const monthStart = m.getTime();
    const monthEnd = addMonths(m, 1).getTime();
    const leftPct = ((monthStart - range.start.getTime()) / total) * 100;
    const widthPct = ((monthEnd - monthStart) / total) * 100;
    const prev = out[out.length - 1];
    if (prev && prev.label === label) {
      prev.widthPct += widthPct;
    } else {
      out.push({ label, leftPct, widthPct });
    }
  }
  return out;
}
