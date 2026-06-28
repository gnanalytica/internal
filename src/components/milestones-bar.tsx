"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Plus, Target, X } from "lucide-react";

import { createMilestone, deleteMilestone, updateMilestone } from "@/lib/actions";
import type { MilestoneWithProgress } from "@/lib/types";
import { cn } from "@/lib/utils";

const toDateInput = (d: Date | string | null) =>
  d ? new Date(d).toISOString().slice(0, 10) : "";

/**
 * Management strip for a project's milestones (release phases). Each card edits
 * a milestone inline — name, target date — and shows its feature count + issue
 * progress. Clicking a card's name filters the roadmap below to that milestone
 * (click again to clear); it does not navigate away.
 */
export function MilestonesBar({
  projectId,
  milestones,
  selectedId,
  onSelect,
}: {
  projectId: string;
  milestones: MilestoneWithProgress[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className="scrollbar-thin flex items-stretch gap-2 overflow-x-auto border-b px-4 py-2">
      {milestones.map((m) => {
        const selected = selectedId === m.id;
        return (
        <div
          key={m.id}
          className={cn(
            "group/ms glow hover-lift flex w-56 shrink-0 flex-col gap-1.5 rounded-lg border bg-background p-2.5 shadow-sm transition-colors",
            selected && "border-brand ring-2 ring-brand/30",
          )}
        >
          <div className="flex items-center gap-1.5">
            <Target className="size-3.5 shrink-0 text-brand" />
            <button
              type="button"
              onClick={() => onSelect(m.id)}
              aria-pressed={selected}
              className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:text-brand"
              title={selected ? `Showing ${m.name} — click to clear` : `Filter by ${m.name}`}
            >
              {m.name}
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete milestone "${m.name}"? Its features stay, unassigned.`))
                  run(() => deleteMilestone(m.id));
              }}
              className="text-muted-foreground opacity-0 transition hover:text-destructive group-hover/ms:opacity-100"
              aria-label="Delete milestone"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <input
            type="date"
            defaultValue={toDateInput(m.targetDate)}
            onChange={(e) =>
              run(() => updateMilestone(m.id, { targetDate: e.target.value || null }))
            }
            className="w-full rounded border bg-transparent px-1.5 py-0.5 text-[11px] text-muted-foreground outline-none focus:border-brand"
            aria-label="Target date"
          />

          <div className="mt-0.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${m.progress.pct}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>
                {m.featureCount} feature{m.featureCount === 1 ? "" : "s"}
              </span>
              <span className="tabular-nums">
                {m.progress.total > 0
                  ? `${m.progress.done}/${m.progress.total} · ${m.progress.pct}%`
                  : "no tasks"}
              </span>
            </div>
          </div>
        </div>
        );
      })}

      <button
        onClick={() => run(() => createMilestone({ projectId }))}
        disabled={pending}
        className={cn(
          "flex w-40 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground transition hover:border-foreground/30 hover:text-foreground",
          milestones.length === 0 && "w-56",
        )}
      >
        <Plus className="size-4" />
        New milestone
      </button>
    </div>
  );
}
