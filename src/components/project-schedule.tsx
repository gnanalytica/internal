import { IssuesView } from "@/components/issues-view";
import type {
  IssueWithRelations,
  Label,
  Member,
  Project,
  SavedView,
} from "@/lib/types";

/**
 * Every task in the project, on the overview.
 *
 * This is the same tool the Tasks tab runs — filters, group-by, sort, saved
 * views, inline editing, and list/board/timeline — rather than a read-only
 * summary. The department cards above answer "who owns what"; this answers
 * "when does it land, and can I fix it right here", which no single department
 * page can show because the work is spread across all of them.
 *
 * `IssuesView` fills its parent (`h-full`, with its own scrolling body), so it
 * needs a sized panel here rather than being dropped straight into the page's
 * scroll container.
 */
export function ProjectSchedule({
  projectId,
  issues,
  projects,
  members,
  labels,
  savedViews,
}: {
  projectId: string;
  issues: IssueWithRelations[];
  projects: Project[];
  members: Member[];
  labels: Label[];
  savedViews: SavedView[];
}) {
  if (issues.length === 0) return null;

  return (
    <section className="mt-6">
      <div className="h-[70vh] min-h-[26rem] overflow-hidden rounded-xl border bg-background">
        <IssuesView
          embedded
          heading="Schedule"
          initialIssues={issues}
          defaultProjectId={projectId}
          projects={projects}
          members={members}
          labels={labels}
          savedViews={savedViews}
          // Keeps this surface's filters and view separate from the Tasks tab's.
          storageScope="overview"
        />
      </div>
    </section>
  );
}
