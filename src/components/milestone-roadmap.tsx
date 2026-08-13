"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { MilestonesBar } from "@/components/milestones-bar";
import { MilestoneStatusChip } from "@/components/pickers";
import { StatusIcon, UserAvatar } from "@/components/glyphs";
import type { StatusId } from "@/lib/constants";
import { formatDate } from "@/lib/matrix-format";
import { issueIdentifier } from "@/lib/types";
import type { IssueWithRelations, MilestoneWithProgress } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The Product roadmap: milestones as dated gates, each listing the tasks that
 * deliver it. Tasks attach straight to a milestone — there is no epic layer
 * between them, so nothing here is derived from a middle object.
 */
export function MilestoneRoadmap({
  projectId,
  milestones,
  issues,
}: {
  projectId: string;
  milestones: MilestoneWithProgress[];
  issues: IssueWithRelations[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<string | null>(null);

  const byMilestone = useMemo(() => {
    const map = new Map<string, IssueWithRelations[]>();
    for (const i of issues) {
      if (!i.milestoneId) continue;
      (map.get(i.milestoneId) ?? map.set(i.milestoneId, []).get(i.milestoneId)!).push(i);
    }
    return map;
  }, [issues]);

  const unassigned = issues.filter((i) => !i.milestoneId).length;
  const shown = filter ? milestones.filter((m) => m.id === filter) : milestones;

  return (
    <div className="flex h-full flex-col">
      <MilestonesBar
        projectId={projectId}
        milestones={milestones}
        selectedId={filter}
        onSelect={(id) => setFilter((prev) => (prev === id ? null : id))}
      />

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
        {milestones.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No milestones yet. Add one above to start the roadmap.
          </p>
        ) : (
          <div className="space-y-5">
            {shown.map((m) => {
              const tasks = byMilestone.get(m.id) ?? [];
              return (
                <section key={m.id}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/projects/${projectId}/milestones/${m.id}`}
                      className="text-sm font-semibold hover:text-brand"
                    >
                      {m.name}
                    </Link>
                    <MilestoneStatusChip status={m.status} />
                    {m.targetDate && (
                      <span className="text-xs text-muted-foreground">
                        {formatDate(m.targetDate)}
                      </span>
                    )}
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                      {m.progress.total > 0
                        ? `${m.progress.done}/${m.progress.total} · ${m.progress.pct}%`
                        : "no tasks"}
                    </span>
                  </div>

                  {tasks.length === 0 ? (
                    <p className="rounded-md border border-dashed px-3 py-4 text-xs text-muted-foreground">
                      Nothing delivers this gate yet.
                    </p>
                  ) : (
                    <ul className="divide-y rounded-md border bg-background">
                      {tasks.map((t) => (
                        <li key={t.id}>
                          <Link
                            href={`/issues/${t.id}`}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
                          >
                            <StatusIcon status={t.status as StatusId} />
                            <span className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground">
                              {issueIdentifier(t)}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{t.title}</span>
                            {t.cycle && (
                              <span className="shrink-0 text-[11px] text-muted-foreground">
                                {t.cycle.name.split(" — ")[0]}
                              </span>
                            )}
                            {t.dueDate && (
                              <span
                                className={cn(
                                  "shrink-0 text-[11px] tabular-nums text-muted-foreground",
                                )}
                              >
                                {formatDate(t.dueDate)}
                              </span>
                            )}
                            {t.assignee && (
                              <UserAvatar
                                name={t.assignee.name}
                                color={t.assignee.avatarColor}
                                className="size-5"
                              />
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {unassigned > 0 && !filter && (
          <p className="mt-6 text-xs text-muted-foreground">
            {unassigned} task{unassigned === 1 ? "" : "s"} deliver no gate — they run inside a cycle
            without clearing a milestone.{" "}
            <button onClick={() => router.push(`/projects/${projectId}/engineering`)} className="underline">
              See all tasks
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
