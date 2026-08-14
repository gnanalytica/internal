import { IssuesView } from "@/components/issues-view";
import { getIssues, getWorkspace } from "@/lib/data";
import { getTaskContext } from "@/lib/task-context";

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project: projectId } = await searchParams;
  const ws = await getWorkspace();
  const [allIssues, ctx] = await Promise.all([getIssues(ws.id), getTaskContext(ws.id)]);
  const { projects } = ctx;

  const activeProject = projectId
    ? projects.find((p) => p.id === projectId) ?? null
    : null;
  const issues = activeProject
    ? allIssues.filter((i) => i.projectId === activeProject.id)
    : allIssues;

  return (
    <IssuesView
      initialIssues={issues}
      projects={projects}
      members={ctx.members}
      labels={ctx.labels}
      heading={activeProject ? activeProject.name : "All tasks"}
      defaultProjectId={activeProject?.id ?? null}
      savedViews={ctx.savedViews}
      cycles={ctx.cycles}
      milestones={ctx.milestones}
      blockedIds={ctx.blockedIds}
    />
  );
}
