"use client";

import { IssuesView } from "@/components/issues-view";
import { Topbar } from "@/components/topbar";
import type { IssueWithRelations, TaskContext } from "@/lib/types";

/**
 * A project's Engineering surface: the build board.
 *
 * Cycles used to live here as a second tab, but a cycle is the whole project's
 * rhythm rather than an engineering sub-concern — and being two clicks deep
 * made the thing you check every Monday the hardest thing to reach. They have
 * their own surface now, at `/projects/[id]/cycles`.
 */
export function EngineeringView({
  heading,
  projectId,
  issues,
  ctx,
}: {
  heading: string;
  projectId: string;
  issues: IssueWithRelations[];
  ctx: TaskContext;
}) {
  return (
    <div className="flex h-full flex-col">
      <Topbar breadcrumb={[{ label: heading }]} />
      <div className="min-h-0 flex-1">
        <IssuesView
          initialIssues={issues}
          projects={ctx.projects}
          members={ctx.members}
          labels={ctx.labels}
          heading={heading}
          defaultProjectId={projectId}
          savedViews={ctx.savedViews}
          cycles={ctx.cycles}
          milestones={ctx.milestones}
          blockedIds={ctx.blockedIds}
          embedded
        />
      </div>
    </div>
  );
}
