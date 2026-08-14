"use client";

import Link from "next/link";
import { useMemo } from "react";

import { IssuesView } from "@/components/issues-view";
import { MilestonesBar } from "@/components/milestones-bar";
import { MilestoneStatusChip } from "@/components/pickers";
import { formatDate } from "@/lib/matrix-format";
import type { IssueWithRelations, MilestoneWithProgress, TaskContext } from "@/lib/types";

/**
 * The Product roadmap: milestones as dated gates, over the tasks that deliver
 * them. Tasks attach straight to a milestone — there is no epic layer between
 * them, so nothing here is derived from a middle object.
 *
 * The gates are what only this surface can show (date, verdict, progress); the
 * work below them is the same task tool as everywhere else, opened grouped by
 * milestone. Picking a gate in the bar narrows the tool to that gate's tasks.
 */
export function MilestoneRoadmap({
  projectId,
  milestones,
  issues,
  ctx,
  selectedId,
  onSelect,
}: {
  projectId: string;
  milestones: MilestoneWithProgress[];
  issues: IssueWithRelations[];
  ctx: TaskContext;
  /** The focused gate, or null for the whole roadmap. Owned by the parent so
   *  the selection survives a tab switch. */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const focused = selectedId ? milestones.find((m) => m.id === selectedId) ?? null : null;

  const shown = useMemo(
    () => (focused ? issues.filter((i) => i.milestoneId === focused.id) : issues),
    [issues, focused],
  );

  const unassigned = issues.filter((i) => !i.milestoneId).length;

  return (
    <div className="flex h-full flex-col">
      <MilestonesBar
        projectId={projectId}
        milestones={milestones}
        selectedId={selectedId}
        onSelect={(id) => onSelect(id === selectedId ? null : id)}
      />

      {milestones.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No milestones yet. Add one above to start the roadmap.
        </p>
      ) : (
        <>
          {focused && (
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
              <Link
                href={`/projects/${projectId}/milestones/${focused.id}`}
                className="text-sm font-semibold hover:text-brand"
              >
                {focused.name}
              </Link>
              <MilestoneStatusChip status={focused.status} />
              {focused.targetDate && (
                <span className="text-xs text-muted-foreground">
                  {formatDate(focused.targetDate)}
                </span>
              )}
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                {focused.progress.total > 0
                  ? `${focused.progress.done}/${focused.progress.total} · ${focused.progress.pct}%`
                  : "no tasks"}
              </span>
              <button
                onClick={() => onSelect(null)}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                Show all gates
              </button>
            </div>
          )}

          <div className="min-h-0 flex-1">
            {shown.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                {focused ? "Nothing delivers this gate yet." : "No tasks on this roadmap yet."}
              </p>
            ) : (
              <IssuesView
                embedded
                heading={focused ? focused.name : "Roadmap"}
                initialIssues={shown}
                defaultProjectId={projectId}
                defaultGroupBy="milestone"
                storageScope="roadmap"
                projects={ctx.projects}
                members={ctx.members}
                labels={ctx.labels}
                savedViews={ctx.savedViews}
                cycles={ctx.cycles}
                milestones={ctx.milestones}
                blockedIds={ctx.blockedIds}
              />
            )}
          </div>

          {unassigned > 0 && !focused && (
            <p className="border-t px-4 py-2 text-xs text-muted-foreground">
              {unassigned} of these task{unassigned === 1 ? "" : "s"} deliver no gate — they run
              inside a cycle without clearing a milestone.
            </p>
          )}
        </>
      )}
    </div>
  );
}
