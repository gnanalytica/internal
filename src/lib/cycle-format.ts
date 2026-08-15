/**
 * How a cycle is written down.
 *
 * A cycle's name is a code — "S1", "W6 — Prod & launch" — which says nothing
 * about when it runs. Everywhere one is offered for selection that left you
 * guessing whether S1 was last month or next. These helpers put the dates back,
 * from one place, so a cycle reads the same in a picker, a filter, a group
 * header and the command palette.
 *
 * Pure, and `now` is always passed in rather than read from the clock, so the
 * "is it running" logic is deterministic and testable.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

type CycleDates = { startDate: Date | string; endDate: Date | string };

const d = (v: Date | string) => (v instanceof Date ? v : new Date(v));

/**
 * "Sep 25 – Oct 1", collapsing the repeated month, and carrying the year only
 * when the range crosses one — a date range that always says 2026 is noise in
 * a list where everything is 2026.
 */
export function cycleRange(cycle: CycleDates): string {
  const start = d(cycle.startDate);
  const end = d(cycle.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";

  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();

  const left = `${MONTHS[start.getUTCMonth()]} ${start.getUTCDate()}`;
  const right = sameMonth
    ? `${end.getUTCDate()}`
    : `${MONTHS[end.getUTCMonth()]} ${end.getUTCDate()}`;

  // Only a cross-year range needs years, and then both, or it reads as a typo.
  if (!sameYear) {
    return `${left}, ${start.getUTCFullYear()} – ${right}, ${end.getUTCFullYear()}`;
  }
  return `${left} – ${right}`;
}

/** Whole days from `now` to the cycle's end; negative once it has ended. */
function daysLeft(cycle: CycleDates, now: Date): number {
  const DAY = 86_400_000;
  return Math.ceil((d(cycle.endDate).getTime() - now.getTime()) / DAY);
}

/**
 * The short status a cycle deserves next to its dates: how long the running one
 * has left, and how long ago the finished ones ended. Returns null when the
 * dates alone say enough.
 */
export function cycleTiming(cycle: CycleDates, now: Date): string | null {
  const start = d(cycle.startDate).getTime();
  const end = d(cycle.endDate).getTime();
  const t = now.getTime();

  if (t < start) {
    const DAY = 86_400_000;
    const days = Math.ceil((start - t) / DAY);
    if (days <= 1) return "starts tomorrow";
    if (days <= 14) return `starts in ${days} days`;
    return null;
  }

  if (t > end) {
    const ago = -daysLeft(cycle, now);
    if (ago <= 1) return "ended yesterday";
    if (ago <= 30) return `ended ${ago} days ago`;
    return null;
  }

  const left = daysLeft(cycle, now);
  if (left <= 0) return "ends today";
  if (left === 1) return "1 day left";
  return `${left} days left`;
}

/**
 * One line for a menu row: the range, plus timing when it adds something.
 * e.g. "Sep 25 – Oct 1 · 3 days left".
 */
export function cycleSubtitle(cycle: CycleDates, now: Date): string {
  const range = cycleRange(cycle);
  const timing = cycleTiming(cycle, now);
  return timing ? `${range} · ${timing}` : range;
}

/**
 * The short code a cycle is known by — "S1" out of "S1 — Launch defects" — for
 * places with no room for the full name, like a task row's chip.
 */
export function cycleCode(name: string): string {
  return name.split(" — ")[0].trim() || name;
}
