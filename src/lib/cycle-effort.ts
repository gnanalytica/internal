import { taskPoints } from "@/lib/points";

/**
 * Where a cycle's effort sits: points per person, done vs open, and what
 * carried in from the last cycle or out to the next. Pure, so it is tested
 * without a database.
 *
 * Points follow lib/points (partial progress counts as done). A task counts once, against its lead assignee (`assigneeId`), so the rows
 * add up to the cycle. An unestimated task weighs 1 point, as in the burndown
 * and velocity, so the three agree; the unestimated count is still shown as
 * something to fix. Canceled work is left out.
 */

export type EffortTask = { id: string; assigneeId: string | null; estimate: number | null; pointsDone?: number | null; status: string };

export type EffortRow = {
  /** Member id, or null for unassigned. */
  id: string | null;
  name: string;
  tasks: number;
  points: number;
  donePoints: number;
  openPoints: number;
  unestimated: number;
};

/** Tasks moved by rollover. `points` is their estimate then; `donePoints` the part done before they moved. */
export type Carried = { count: number; points: number; donePoints: number; unestimated: number };

export function cycleEffort(tasks: EffortTask[], members: { id: string; name: string }[]): { rows: EffortRow[]; total: EffortRow } {
  const rows = new Map<string | null, EffortRow>();
  const blank = (id: string | null, name: string): EffortRow => ({ id, name, tasks: 0, points: 0, donePoints: 0, openPoints: 0, unestimated: 0 });
  const total = blank(null, "Total");
  for (const t of tasks) {
    if (t.status === "canceled") continue;
    const id = t.assigneeId && members.some((m) => m.id === t.assigneeId) ? t.assigneeId : null;
    const row = rows.get(id) ?? blank(id, id ? members.find((m) => m.id === id)!.name : "Unassigned");
    rows.set(id, row);
    const p = taskPoints(t);
    for (const r of [row, total]) {
      r.tasks++;
      if (t.estimate == null) r.unestimated++;
      r.points += p.total;
      r.donePoints += p.done;
      r.openPoints += p.open;
    }
  }
  // Most points first; unassigned last, as the row to sort out.
  const list = [...rows.values()].sort((a, b) => (a.id === null ? 1 : b.id === null ? -1 : b.points - a.points || a.name.localeCompare(b.name)));
  return { rows: list, total };
}

export function carried(tasks: { estimate: number | null; done?: number }[]): Carried {
  return {
    count: tasks.length,
    points: tasks.reduce((n, t) => n + (t.estimate ?? 1), 0),
    donePoints: tasks.reduce((n, t) => n + Math.min(t.done ?? 0, t.estimate ?? 1), 0),
    unestimated: tasks.filter((t) => t.estimate == null).length,
  };
}
