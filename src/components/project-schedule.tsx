"use client";

import { useMemo, useState } from "react";
import { GanttChartSquare, List as ListIcon } from "lucide-react";

import { DepartmentTasks } from "@/components/department-tasks";
import { IssueTimelineView } from "@/components/issue-timeline-view";
import type { IssueWithRelations, Member } from "@/lib/types";
import { NARROW_SCREEN, useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

type View = "timeline" | "list";

/**
 * Every task in the project on one surface, as a gantt (start → due, grouped by
 * status) or a flat list. The department cards above answer "who owns what";
 * this answers "when does it land", which no single department page can show
 * because the work is spread across all of them.
 *
 * The gantt is the same component the Tasks page uses, so bars stay draggable
 * and rescheduling writes straight through.
 */
export function ProjectSchedule({
  issues,
  members,
}: {
  issues: IssueWithRelations[];
  members: Member[];
}) {
  // A gantt needs width a phone doesn't have, so narrow screens open on the
  // list instead. Only the default is derived — once someone picks a view it
  // sticks, on any screen size.
  const narrow = useMediaQuery(NARROW_SCREEN);
  const [chosen, setChosen] = useState<View | null>(null);
  const view: View = chosen ?? (narrow ? "list" : "timeline");
  const setView = setChosen;

  // Sub-issues inherit their parent's dates and would draw a duplicate bar for
  // the same work, so the schedule tracks top-level tasks only.
  const topLevel = useMemo(() => issues.filter((i) => !i.parentId), [issues]);

  const scheduled = topLevel.filter((i) => i.startDate || i.dueDate).length;
  const open = topLevel.filter(
    (i) => i.status !== "done" && i.status !== "canceled",
  ).length;

  if (topLevel.length === 0) return null;

  return (
    <section className="mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">Schedule</h2>
          <p className="text-xs text-muted-foreground">
            {topLevel.length} tasks · {open} open · {scheduled} with dates
          </p>
        </div>
        <div className="flex items-center rounded-md border p-0.5">
          <ViewButton active={view === "timeline"} onClick={() => setView("timeline")}>
            <GanttChartSquare className="size-3.5" /> Timeline
          </ViewButton>
          <ViewButton active={view === "list"} onClick={() => setView("list")}>
            <ListIcon className="size-3.5" /> List
          </ViewButton>
        </div>
      </div>

      {view === "timeline" ? (
        scheduled === 0 ? (
          <p className="rounded-md border bg-background py-10 text-center text-sm text-muted-foreground">
            No task has a start or due date yet, so there is nothing to plot.
            Set dates on a task and it appears here.
          </p>
        ) : (
          <IssueTimelineView issues={topLevel} members={members} />
        )
      ) : (
        <DepartmentTasks issues={topLevel} emptyLabel="No tasks in this project yet." />
      )}
    </section>
  );
}

function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors",
        active
          ? "bg-accent font-medium text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
