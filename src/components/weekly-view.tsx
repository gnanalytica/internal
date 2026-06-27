import Link from "next/link";
import { format } from "date-fns";
import { Timer } from "lucide-react";

import { Topbar } from "@/components/topbar";
import type { CycleWithCount, Project } from "@/lib/types";

/**
 * The company "Weekly" rollup: each shippable project with its currently-active
 * cycle and progress. Cycles are planned per project (Engineering tab); this is
 * the cross-project review surface, not a separate cadence.
 */
export function WeeklyView({
  projects,
  cycles,
  nowISO,
  embedded = false,
}: {
  projects: Project[];
  cycles: CycleWithCount[];
  nowISO: string;
  /** Hide the page Topbar when rendered inside the Projects tabs. */
  embedded?: boolean;
}) {
  const now = new Date(nowISO);
  const activeFor = (projectId: string) =>
    cycles.find(
      (c) =>
        c.projectId === projectId &&
        new Date(c.startDate) <= now &&
        new Date(c.endDate) >= now,
    ) ?? null;

  return (
    <div className="flex h-full flex-col">
      {!embedded && <Topbar breadcrumb={[{ label: "Weekly" }]} />}
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-6 py-8">
          <p className="mb-4 text-sm text-muted-foreground">
            This week across every project — each project&apos;s active cycle and progress.
          </p>
          <div className="space-y-2">
            {projects.map((p) => {
              const c = activeFor(p.id);
              const pct = c && c.issueCount ? Math.round((c.doneCount / c.issueCount) * 100) : 0;
              return (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}/engineering`}
                  className="flex items-center gap-4 rounded-xl border px-4 py-3 transition-colors hover:border-foreground/20 hover:bg-accent/40"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                    style={{ backgroundColor: p.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{p.name}</div>
                    {c ? (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Timer className="size-3.5" />
                        {c.name} · {format(new Date(c.startDate), "MMM d")} –{" "}
                        {format(new Date(c.endDate), "MMM d")}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">No active cycle</div>
                    )}
                  </div>
                  {c && (
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
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
