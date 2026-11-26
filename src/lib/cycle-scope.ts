import { cycleStatus } from "@/lib/types";

/**
 * "Which cycle" for a list that spans projects (My tasks). Cycles belong to a
 * project, so each choice is a set of cycles, one per project at most:
 *
 * - current: every cycle running today;
 * - next: each project's soonest cycle that hasn't started;
 * - previous: each project's most recently finished cycle.
 *
 * Kept as the choice rather than ids, so "current" is still current next week.
 */
export type CycleScope = "current" | "next" | "previous";

export const CYCLE_SCOPES: { id: CycleScope; label: string }[] = [
  { id: "previous", label: "Previous" },
  { id: "current", label: "Current" },
  { id: "next", label: "Next" },
];

type C = { id: string; projectId: string; startDate: Date | string; endDate: Date | string };

export function cyclesInScope(scope: CycleScope, cycles: C[], now: Date): Set<string> {
  if (scope === "current") return new Set(cycles.filter((c) => cycleStatus(c, now) === "active").map((c) => c.id));
  const best = new Map<string, C>();
  for (const c of cycles) {
    const s = cycleStatus(c, now);
    if (scope === "next" && s !== "upcoming") continue;
    if (scope === "previous" && s !== "completed") continue;
    const prev = best.get(c.projectId);
    const t = (x: C) => new Date(scope === "next" ? x.startDate : x.endDate).getTime();
    if (!prev || (scope === "next" ? t(c) < t(prev) : t(c) > t(prev))) best.set(c.projectId, c);
  }
  return new Set([...best.values()].map((c) => c.id));
}
