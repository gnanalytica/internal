"use client";

import { useMemo } from "react";

import { IssuesView } from "@/components/issues-view";
import { issueBelongsToDepartment, type DepartmentSlug } from "@/lib/departments";
import type { IssueWithRelations, TaskContext } from "@/lib/types";

/**
 * The tasks on one department's surface — the same issues as the global board,
 * filtered to the tracks that department owns.
 *
 * Scoping is this component's whole job; presentation is `IssuesView`'s, so a
 * department gets the same list/board/timeline, filters, group-by and inline
 * editing as everywhere else rather than a read-only list of its own.
 */
export function DepartmentTasks({
  issues,
  department,
  ctx,
  projectId,
  emptyLabel,
}: {
  issues: IssueWithRelations[];
  department: DepartmentSlug;
  ctx: TaskContext;
  /** Scopes new tasks and the cycle/milestone menus to this project. */
  projectId?: string | null;
  emptyLabel?: string;
}) {
  // Top-level tasks only. Sub-issues carry the same labels as their parent, so
  // including them would list every item twice — once as work and once as its
  // own breakdown. The parent's detail page is where the breakdown belongs.
  const mine = useMemo(
    () =>
      issues.filter((i) => !i.parentId && issueBelongsToDepartment(i.labels, department)),
    [issues, department],
  );

  if (mine.length === 0)
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {emptyLabel ?? "No tasks on this surface yet."}
      </p>
    );

  return (
    <IssuesView
      embedded
      heading="Tasks"
      initialIssues={mine}
      defaultProjectId={projectId ?? null}
      // Each department keeps its own filters and chosen view; without this
      // they would all share one project's persisted state.
      storageScope={`dept:${department}`}
      projects={ctx.projects}
      members={ctx.members}
      labels={ctx.labels}
      savedViews={ctx.savedViews}
      cycles={ctx.cycles}
      milestones={ctx.milestones}
      blockedIds={ctx.blockedIds}
    />
  );
}
