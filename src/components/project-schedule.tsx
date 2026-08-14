import { TaskPanel } from "@/components/task-panel";
import type { IssueWithRelations, TaskContext } from "@/lib/types";

/**
 * Every task in the project, on the overview.
 *
 * This is the same tool the Tasks tab runs — filters, group-by, sort, saved
 * views, inline editing, and list/board/timeline — rather than a read-only
 * summary. The department cards above answer "who owns what"; this answers
 * "when does it land, and can I fix it right here", which no single department
 * page can show because the work is spread across all of them.
 */
export function ProjectSchedule({
  projectId,
  issues,
  ctx,
}: {
  projectId: string;
  issues: IssueWithRelations[];
  ctx: TaskContext;
}) {
  if (issues.length === 0) return null;

  return (
    <section className="mt-6">
      <TaskPanel
        heading="Schedule"
        issues={issues}
        ctx={ctx}
        projectId={projectId}
        // Keeps this surface's filters and view separate from the Tasks tab's.
        storageScope="overview"
      />
    </section>
  );
}
