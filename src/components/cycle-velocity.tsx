"use client";

import { useMemo } from "react";
import { TrendingUp } from "lucide-react";

import { computeVelocity } from "@/lib/velocity";
import type { CycleWithCount } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * What this project actually completes per cycle, and what that implies for
 * the work still open.
 *
 * The per-cycle burndown says whether one cycle is on track; this says what to
 * commit to next. Only finished cycles count — a running cycle is partial by
 * definition, and averaging it in makes the next plan quietly optimistic.
 */
export function CycleVelocity({
  cycles,
  outstandingPoints,
  nowISO,
}: {
  cycles: CycleWithCount[];
  /** Open points not yet in a finished cycle, for the projection. */
  outstandingPoints: number;
  /** Passed from the server so the client doesn't re-derive "now" and mismatch. */
  nowISO: string;
}) {
  const v = useMemo(
    () =>
      computeVelocity({
        cycles: cycles.map((c) => ({
          id: c.id,
          name: c.name,
          endDate: new Date(c.endDate),
          issues: c.issues,
        })),
        outstandingPoints,
        now: new Date(nowISO),
      }),
    [cycles, outstandingPoints, nowISO],
  );

  // One finished cycle is a data point, not a trend — say so rather than
  // presenting an "average" of a single number as if it were predictive.
  if (v.cycles.length === 0) return null;

  const peak = Math.max(...v.cycles.map((c) => c.donePoints), 1);
  const shown = v.cycles.slice(-12);

  return (
    <div className="mb-3 rounded-xl border bg-background px-3 py-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <TrendingUp className="size-4 self-center text-muted-foreground" />
        <span className="text-sm font-medium">Velocity</span>
        {v.cycles.length === 1 ? (
          <span className="text-xs text-muted-foreground">
            Only {v.cycles[0].name.split(" — ")[0]} has finished, completing{" "}
            {v.averagePoints} pts — not a trend yet.
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {v.averagePoints} pts per cycle · {v.averageCompletionPct}% of committed work lands
          </span>
        )}
        {v.cyclesToClear !== null && (
          <span className="ml-auto text-xs text-muted-foreground">
            {outstandingPoints} pts open ·{" "}
            <strong className="font-medium text-foreground">
              ~{v.cyclesToClear} cycle{v.cyclesToClear === 1 ? "" : "s"}
            </strong>{" "}
            at this rate
          </span>
        )}
      </div>

      <div className="mt-3 flex items-end gap-1" role="img" aria-label="Completed points per finished cycle">
        {shown.map((c) => (
          <div key={c.id} className="group/bar flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-[10px] tabular-nums text-muted-foreground opacity-0 transition group-hover/bar:opacity-100">
              {c.donePoints}
            </span>
            <div
              className={cn(
                "w-full rounded-t bg-brand/70 transition-colors group-hover/bar:bg-brand",
                c.donePoints === 0 && "bg-muted",
              )}
              style={{ height: `${Math.max(2, (c.donePoints / peak) * 48)}px` }}
              title={`${c.name}: ${c.donePoints} pts · ${c.doneCount} tasks · ${c.completionPct}% of committed`}
            />
            <span className="w-full truncate text-center text-[10px] text-muted-foreground">
              {c.name.split(" — ")[0]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
