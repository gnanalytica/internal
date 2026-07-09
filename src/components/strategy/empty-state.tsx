"use client";

import { applyStrategyOpAction } from "@/lib/strategy-actions";

export function StrategyEmptyState({ projectId }: { projectId: string }) {
  return (
    <div className="s-rise mx-auto mt-10 max-w-md rounded-xl border bg-card p-6 text-center">
      <h2 className="text-sm font-bold uppercase tracking-wider">Set up Strategy</h2>
      <p className="mt-2 text-xs text-muted-foreground">
        Vision &amp; path · FDV scorecard · initiatives · traction · unit economics · market backdrop.
        Start from the shape template (three stage-gates, empty pillars) and fill it in-place — nothing
        is pre-written.
      </p>
      <button
        type="button"
        className="s-chip mt-4 border-teal-500/50 text-teal-600 dark:text-teal-400"
        onClick={() => applyStrategyOpAction(projectId, { kind: "seedTemplate" })}
      >
        Start from template
      </button>
    </div>
  );
}
