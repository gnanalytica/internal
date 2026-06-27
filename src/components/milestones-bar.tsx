"use client";

import Link from "next/link";
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
 * progress. The roadmap below groups features under these milestones.
 */
export function MilestonesBar({
  projectId,
  milestones,
}: {
  projectId: string;
  milestones: MilestoneWithProgress[];
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
      {milestones.map((m) => (
        <div
          key={m.id}
          className="group/ms glow hover-lift flex w-56 shrink-0 flex-col gap-1.5 rounded-lg border bg-background p-2.5 shadow-sm"
        >
          <div className="flex items-center gap-1.5">
            <Target className="size-3.5 shrink-0 text-brand" />
            <Link
              href={`/projects/${projectId}/milestones/${m.id}`}
              className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
              title={`Open ${m.name}`}
            >
              {m.name}
            </Link>
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
                  : "no issues"}
              </span>
            </div>
          </div>
        </div>
      ))}

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
