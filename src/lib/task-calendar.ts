import { istDay } from "@/lib/scorecard";

/**
 * The month grid for the task calendar: whole weeks, Monday first, as
 * yyyy-mm-dd days. Pure and string-based, so it never drifts with the
 * browser's timezone; tasks are placed by their due date's India-time day,
 * the same day `dueLabel` uses.
 */
export function monthGrid(month: string): string[][] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday = 0
  const start = new Date(first);
  start.setUTCDate(1 - lead);
  const last = new Date(Date.UTC(y, m, 0));
  const tail = 6 - ((last.getUTCDay() + 6) % 7);
  const days = Math.round((last.getTime() - start.getTime()) / 86_400_000) + 1 + tail;
  const weeks: string[][] = [];
  for (let i = 0; i < days; i += 7) {
    weeks.push(
      Array.from({ length: 7 }, (_, j) => {
        const d = new Date(start);
        d.setUTCDate(start.getUTCDate() + i + j);
        return d.toISOString().slice(0, 10);
      }),
    );
  }
  return weeks;
}

/** yyyy-mm shifted by `n` months. */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** Tasks by their due day (India time); the undated in their own list. */
export function byDueDay<T extends { dueDate: Date | string | null }>(items: T[]): { days: Map<string, T[]>; undated: T[] } {
  const days = new Map<string, T[]>();
  const undated: T[] = [];
  for (const i of items) {
    if (!i.dueDate) {
      undated.push(i);
      continue;
    }
    const k = istDay(i.dueDate);
    days.set(k, [...(days.get(k) ?? []), i]);
  }
  return { days, undated };
}
