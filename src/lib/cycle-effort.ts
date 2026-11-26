/**
 * Where a cycle's effort sits: points per person, done vs open, and what
 * carried in from the last cycle or out to the next. Pure, so it is tested
 * without a database.
 *
 * A task counts once, against its lead assignee (`assigneeId`), so the rows
 * add up to the cycle. Unestimated tasks are counted, not guessed: they show
 * as a number to fix rather than a silent 1. Canceled work is left out.
 */

export type EffortTask = { id: string; assigneeId: string | null; estimate: number | null; status: string };

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

export type Carried = { count: number; points: number; unestimated: number };

export function cycleEffort(tasks: EffortTask[], members: { id: string; name: string }[]): { rows: EffortRow[]; total: EffortRow } {
  const rows = new Map<string | null, EffortRow>();
  const blank = (id: string | null, name: string): EffortRow => ({ id, name, tasks: 0, points: 0, donePoints: 0, openPoints: 0, unestimated: 0 });
  const total = blank(null, "Total");
  for (const t of tasks) {
    if (t.status === "canceled") continue;
    const id = t.assigneeId && members.some((m) => m.id === t.assigneeId) ? t.assigneeId : null;
    const row = rows.get(id) ?? blank(id, id ? members.find((m) => m.id === id)!.name : "Unassigned");
    rows.set(id, row);
    for (const r of [row, total]) {
      r.tasks++;
      if (t.estimate == null) r.unestimated++;
      const pts = t.estimate ?? 0;
      r.points += pts;
      if (t.status === "done") r.donePoints += pts;
      else r.openPoints += pts;
    }
  }
  // Most points first; unassigned last, as the row to sort out.
  const list = [...rows.values()].sort((a, b) => (a.id === null ? 1 : b.id === null ? -1 : b.points - a.points || a.name.localeCompare(b.name)));
  return { rows: list, total };
}

export function carried(tasks: { estimate: number | null }[]): Carried {
  return {
    count: tasks.length,
    points: tasks.reduce((n, t) => n + (t.estimate ?? 0), 0),
    unestimated: tasks.filter((t) => t.estimate == null).length,
  };
}
