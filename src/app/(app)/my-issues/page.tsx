import { IssuesView } from "@/components/issues-view";
import { getCurrentUser, getIssues, getWorkspace } from "@/lib/data";
import { getTaskContext } from "@/lib/task-context";

export default async function MyIssuesPage() {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const [allIssues, ctx] = await Promise.all([getIssues(ws.id), getTaskContext(ws.id)]);

  // Issues where I'm the primary assignee or one of the co-assignees.
  const mine = allIssues.filter(
    (i) => i.assigneeId === me.id || i.assignees.some((a) => a.id === me.id),
  );

  return (
    <IssuesView
      initialIssues={mine}
      projects={ctx.projects}
      members={ctx.members}
      labels={ctx.labels}
      heading="My Issues"
      defaultProjectId={null}
      savedViews={ctx.savedViews}
      cycles={ctx.cycles}
      milestones={ctx.milestones}
      blockedIds={ctx.blockedIds}
    />
  );
}
