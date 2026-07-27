/**
 * Pure, estimate-weighted cycle burndown. Reconstructs remaining work per day
 * from issue creation ("scope in") and completion timestamps, so it can be
 * unit-tested without a database. `now` is passed in — never read the clock
 * here — to keep results deterministic.
 */

type Issue = { id: string; estimate: number | null; createdAt: Date };
type DoneEvent = { issueId: string; at: Date };

const DAY_MS = 86_400_000;

/** UTC midnight of the given date. */
function startOfUtcDay(date: Date): number {
  const dt = new Date(date);
  dt.setUTCHours(0, 0, 0, 0);
  return dt.getTime();
}

/** Which cycle-day (0-based) a timestamp falls on, relative to the start day. */
function dayIndexOf(ms: number, startMs: number): number {
  return Math.floor((ms - startMs) / DAY_MS);
}

function isoDay(startMs: number, dayIndex: number): string {
  return new Date(startMs + dayIndex * DAY_MS).toISOString().slice(0, 10);
}

export function computeBurndown(input: {
  issues: Issue[];
  doneEvents: DoneEvent[];
  start: Date;
  end: Date;
  now: Date;
}): {
  points: { date: string; remaining: number; ideal: number }[];
  totalPoints: number;
} {
  const { issues, doneEvents, start, end, now } = input;
  const weight = (i: Issue) => i.estimate ?? 1;
  const totalPoints = issues.reduce((s, i) => s + weight(i), 0);
  if (issues.length === 0) return { points: [], totalPoints: 0 };

  // Latest completion timestamp per issue.
  const doneAt = new Map<string, number>();
  for (const e of doneEvents) {
    const t = e.at.getTime();
    const prev = doneAt.get(e.issueId);
    if (prev === undefined || t > prev) doneAt.set(e.issueId, t);
  }

  const startMs = startOfUtcDay(start);
  const lastMs = Math.min(end.getTime(), now.getTime());
  const spanDays = Math.max(0, Math.floor((lastMs - startMs) / DAY_MS));
  const totalSpan = Math.max(1, Math.floor((end.getTime() - startMs) / DAY_MS));

  const points: { date: string; remaining: number; ideal: number }[] = [];
  for (let day = 0; day <= spanDays; day++) {
    let remaining = 0;
    for (const i of issues) {
      if (dayIndexOf(i.createdAt.getTime(), startMs) > day) continue; // not yet in scope
      const done = doneAt.get(i.id);
      if (done !== undefined && dayIndexOf(done, startMs) <= day) continue; // completed
      remaining += weight(i);
    }
    const ideal = Math.max(0, totalPoints * (1 - day / totalSpan));
    points.push({
      date: isoDay(startMs, day),
      remaining,
      ideal: Math.round(ideal * 100) / 100,
    });
  }
  return { points, totalPoints };
}
