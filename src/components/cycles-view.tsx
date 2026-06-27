"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { format } from "date-fns";
import { Plus, Timer } from "lucide-react";

import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { createCycle } from "@/lib/actions";
import type { CycleWithCount } from "@/lib/types";
import { cycleStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<string, string> = {
  upcoming: "bg-muted text-muted-foreground",
  active: "bg-brand/10 text-brand",
  completed: "bg-emerald-500/10 text-emerald-600",
};

export function CyclesView({
  cycles,
  projectId,
  embedded = false,
}: {
  cycles: CycleWithCount[];
  /** When set, cycles are scoped to this project and creation is enabled. */
  projectId?: string;
  /** Render without the page Topbar (e.g. inside a project's Engineering tab). */
  embedded?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const now = new Date();

  function newCycle() {
    if (!projectId) return;
    startTransition(async () => {
      const start = new Date();
      const end = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);
      const c = await createCycle({
        projectId,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });
      router.push(`/cycles/${c.id}`);
      router.refresh();
    });
  }

  const createButton = projectId ? (
    <Button size="sm" className="h-7 gap-1.5" onClick={newCycle} disabled={pending}>
      <Plus className="size-4" /> New cycle
    </Button>
  ) : null;

  return (
    <div className="flex h-full flex-col">
      {!embedded && <Topbar breadcrumb={[{ label: "Cycles" }]} actions={createButton} />}
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-6 py-8">
          {embedded && createButton && <div className="mb-3 flex justify-end">{createButton}</div>}
          {cycles.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <div className="grid size-12 place-items-center rounded-xl border bg-muted/50">
                <Timer className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No cycles yet</p>
                <p className="text-xs text-muted-foreground">
                  {projectId
                    ? "Cycles are time-boxed sprints. Create one to plan this project's work."
                    : "Cycles are planned inside each project."}
                </p>
              </div>
              {createButton}
            </div>
          ) : (
            <div className="space-y-2">
              {cycles.map((c) => {
                const status = cycleStatus(c, now);
                const pct = c.issueCount ? Math.round((c.doneCount / c.issueCount) * 100) : 0;
                return (
                  <Link
                    key={c.id}
                    href={`/cycles/${c.id}`}
                    className="flex items-center gap-4 rounded-xl border px-4 py-3 transition-colors hover:border-foreground/20 hover:bg-accent/40"
                  >
                    <Timer className="size-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {!projectId && c.projectName && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-inset ring-border"
                          >
                            <span
                              className="size-1.5 rounded-full"
                              style={{ backgroundColor: c.projectColor }}
                            />
                            {c.projectName}
                          </span>
                        )}
                        <span className="truncate text-sm font-medium">{c.name}</span>
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize",
                            STATUS_STYLE[status],
                          )}
                        >
                          {status}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(c.startDate), "MMM d")} –{" "}
                        {format(new Date(c.endDate), "MMM d, yyyy")}
                      </div>
                    </div>
                    <div className="w-32 shrink-0">
                      <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>
                          {c.doneCount}/{c.issueCount}
                        </span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-brand transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
