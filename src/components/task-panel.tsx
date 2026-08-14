import { IssuesView } from "@/components/issues-view";
import type { GroupBy } from "@/lib/issue-filters";
import type { IssueWithRelations, TaskContext } from "@/lib/types";

/**
 * The task tool embedded in a document-style page (a milestone, a feature, an
 * operation's overview).
 *
 * `IssuesView` fills its parent and scrolls itself, so dropping it straight
 * into a page's own scroll container would collapse it. This gives it a sized
 * box instead — the same shape the project overview's schedule uses — so any
 * page can offer list, board and timeline without becoming a full-height
 * surface itself.
 */
export function TaskPanel({
  heading,
  issues,
  ctx,
  projectId = null,
  storageScope,
  defaultGroupBy,
}: {
  heading: string;
  issues: IssueWithRelations[];
  ctx: TaskContext;
  projectId?: string | null;
  storageScope?: string;
  defaultGroupBy?: GroupBy;
}) {
  if (issues.length === 0) return null;

  return (
    <div className="h-[70vh] min-h-[26rem] overflow-hidden rounded-xl border bg-background">
      <IssuesView
        embedded
        heading={heading}
        initialIssues={issues}
        defaultProjectId={projectId}
        defaultGroupBy={defaultGroupBy}
        storageScope={storageScope}
        projects={ctx.projects}
        members={ctx.members}
        labels={ctx.labels}
        savedViews={ctx.savedViews}
        cycles={ctx.cycles}
        milestones={ctx.milestones}
        blockedIds={ctx.blockedIds}
      />
    </div>
  );
}
