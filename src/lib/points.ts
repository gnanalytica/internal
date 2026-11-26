/**
 * One rule for a task's points, used by burndown, velocity, effort and
 * planning so they always agree:
 *
 * - total: the estimate, or 1 when unestimated (a task is never weightless);
 * - done: all of it once the task is Done, else the points marked done so far
 *   (never more than the total);
 * - canceled work counts for neither (callers filter it out).
 */
export type PointsTask = { status: string; estimate: number | null; pointsDone?: number | null };

export function taskPoints(t: PointsTask): { total: number; done: number; open: number } {
  const total = t.estimate ?? 1;
  const done = t.status === "done" ? total : Math.min(Math.max(t.pointsDone ?? 0, 0), total);
  return { total, done, open: total - done };
}

/**
 * The points-done value a write should store: a whole number from 0 to the
 * estimate, and only when there is an estimate. Null clears it.
 */
export function clampPointsDone(pointsDone: number | null | undefined, estimate: number | null): number | null {
  if (pointsDone == null || estimate == null) return null;
  if (!Number.isFinite(pointsDone)) return null;
  return Math.min(Math.max(Math.round(pointsDone), 0), estimate) || null;
}
