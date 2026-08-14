/**
 * A project's repeating cycle ceremonies.
 *
 * A team's cadence is written down once ("Friday sprint planning · daily
 * 15-min standup · Thursday demo + metrics review + retro") and then holds for
 * every cycle. Without this the ceremonies get hand-entered per cycle, which is
 * both busywork and unreliable — the cycle where someone forgot to add the
 * retro is the cycle with no retro.
 *
 * Stored on `projects.cycleCadence`; this module only derives from it. Kept
 * pure and side-effect-free so the date maths is unit-tested.
 */
import { ISSUE_TYPES, PRIORITIES, type PriorityId } from "@/lib/constants";

export type Ceremony = {
  /** Task title, used verbatim — also the key that makes stamping idempotent. */
  title: string;
  /** Functional task type id (see ISSUE_TYPES). Defaults to "engineering". */
  type?: string;
  priority?: PriorityId;
  /** Story points, so ceremonies show up honestly in burndown and velocity. */
  estimate?: number | null;
  /**
   * Which day of the cycle this lands on, 0-based from the cycle's start date.
   * A cycle running Fri–Thu puts planning at 0 and the demo/retro at 6. Null
   * means the ceremony runs throughout (a daily standup), so it gets no due
   * date rather than a misleading one.
   */
  dayOffset?: number | null;
};

export type CycleCadence = { ceremonies: Ceremony[] };

const DAY_MS = 86_400_000;

export function isCadenceEmpty(cadence: CycleCadence | null): boolean {
  return !cadence || cadence.ceremonies.length === 0;
}

/** Drop blank titles and clamp each ceremony to a shape the DB will accept. */
export function normalizeCadence(input: CycleCadence | null): CycleCadence {
  const types = new Set<string>(ISSUE_TYPES.map((t) => t.id));
  const priorities = new Set<string>(PRIORITIES.map((p) => p.id));

  const ceremonies = (input?.ceremonies ?? []).flatMap<Ceremony>((c) => {
    const title = c.title?.trim();
    if (!title) return [];
    const estimate =
      typeof c.estimate === "number" && Number.isFinite(c.estimate) && c.estimate >= 0
        ? Math.round(c.estimate)
        : null;
    const dayOffset =
      typeof c.dayOffset === "number" && Number.isFinite(c.dayOffset) && c.dayOffset >= 0
        ? Math.round(c.dayOffset)
        : null;
    return [
      {
        title,
        type: c.type && types.has(c.type) ? c.type : "engineering",
        priority: c.priority && priorities.has(c.priority) ? c.priority : "none",
        estimate,
        dayOffset,
      },
    ];
  });

  return { ceremonies };
}

/**
 * The tasks a cadence produces for one cycle, skipping any whose title is
 * already in the cycle.
 *
 * Title-matching is what makes applying a cadence safe to repeat: a cycle that
 * already has "Fri: sprint planning" doesn't get a second one, so re-running
 * after editing the cadence adds only what's new.
 */
export function ceremonyTasksFor(
  cadence: CycleCadence | null,
  cycle: { startDate: Date; endDate: Date },
  existingTitles: string[],
): { title: string; type: string; priority: string; estimate: number | null; dueDate: Date | null }[] {
  const taken = new Set(existingTitles.map((t) => t.trim().toLowerCase()));
  const startMs = cycle.startDate.getTime();
  // A ceremony can't fall outside its own cycle, however the cadence is edited.
  const lastDay = Math.max(0, Math.floor((cycle.endDate.getTime() - startMs) / DAY_MS));

  return normalizeCadence(cadence)
    .ceremonies.filter((c) => !taken.has(c.title.toLowerCase()))
    .map((c) => ({
      title: c.title,
      type: c.type ?? "engineering",
      priority: c.priority ?? "none",
      estimate: c.estimate ?? null,
      dueDate:
        c.dayOffset === null || c.dayOffset === undefined
          ? null
          : new Date(startMs + Math.min(c.dayOffset, lastDay) * DAY_MS),
    }));
}
