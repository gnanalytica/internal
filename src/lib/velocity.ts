/**
 * Cycle velocity — how much a team actually finishes per cycle.
 *
 * Burndown answers "are we on track inside this cycle"; velocity answers "what
 * should we commit to in the next one". Deliberately measured only over
 * *finished* cycles: a cycle still running is partial by definition, and
 * averaging it in drags the number down and makes plans quietly optimistic.
 *
 * Points weight a task by its estimate, falling back to 1 so an unestimated
 * cycle still produces a usable count — the same weighting `computeBurndown`
 * uses, so the two surfaces never disagree.
 */

export type VelocityCycle = {
  id: string;
  name: string;
  endDate: Date;
  /** Every task in the cycle, with its estimate and whether it landed. */
  issues: { status: string; estimate: number | null }[];
};

export type CycleVelocity = {
  id: string;
  name: string;
  donePoints: number;
  doneCount: number;
  /** Share of the cycle's committed points that landed, 0–100. */
  completionPct: number;
};

export type VelocitySummary = {
  /** Finished cycles, oldest first, so a chart reads left-to-right in time. */
  cycles: CycleVelocity[];
  /** Mean points per finished cycle, rounded to one decimal. */
  averagePoints: number;
  /** Mean share of committed points completed, 0–100. */
  averageCompletionPct: number;
  /**
   * Cycles needed to clear `outstandingPoints` at the average, or null when
   * there is nothing outstanding or no velocity to project from.
   */
  cyclesToClear: number | null;
};

const weight = (i: { estimate: number | null }) => i.estimate ?? 1;
const isDone = (i: { status: string }) => i.status === "done";
// Canceled work was decided against, not completed and not outstanding.
const isCounted = (i: { status: string }) => i.status !== "canceled";

/**
 * Velocity over the cycles that have ended, plus a projection for whatever is
 * still open.
 *
 * `now` is passed in rather than read from the clock so results are
 * deterministic and testable.
 */
export function computeVelocity(input: {
  cycles: VelocityCycle[];
  /** Points still to do — typically the open work not yet in a finished cycle. */
  outstandingPoints?: number;
  now: Date;
  /** How many recent cycles to average over. Older ones stop being predictive. */
  window?: number;
}): VelocitySummary {
  const { cycles, outstandingPoints = 0, now, window = 6 } = input;

  const finished = cycles
    .filter((c) => c.endDate.getTime() <= now.getTime())
    .sort((a, b) => a.endDate.getTime() - b.endDate.getTime())
    .map<CycleVelocity>((c) => {
      const counted = c.issues.filter(isCounted);
      const committed = counted.reduce((s, i) => s + weight(i), 0);
      const donePoints = counted.filter(isDone).reduce((s, i) => s + weight(i), 0);
      return {
        id: c.id,
        name: c.name,
        donePoints,
        doneCount: counted.filter(isDone).length,
        completionPct: committed > 0 ? Math.round((donePoints / committed) * 100) : 0,
      };
    });

  // Average over the most recent window, but report every finished cycle so the
  // chart still shows the full history.
  const recent = finished.slice(-window);
  const round1 = (n: number) => Math.round(n * 10) / 10;

  const averagePoints =
    recent.length > 0 ? round1(recent.reduce((s, c) => s + c.donePoints, 0) / recent.length) : 0;
  const averageCompletionPct =
    recent.length > 0
      ? Math.round(recent.reduce((s, c) => s + c.completionPct, 0) / recent.length)
      : 0;

  const cyclesToClear =
    outstandingPoints > 0 && averagePoints > 0
      ? Math.ceil(outstandingPoints / averagePoints)
      : null;

  return { cycles: finished, averagePoints, averageCompletionPct, cyclesToClear };
}
