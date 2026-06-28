import { IssuesView } from "@/components/issues-view";
import {
  getIssues,
  getLabels,
  getMembers,
  getProjects,
  getSavedViews,
  getWorkspace,
} from "@/lib/data";

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project: projectId } = await searchParams;
  const ws = await getWorkspace();
  const [allIssues, projects, members, labels, savedViews] = await Promise.all([
    getIssues(ws.id),
    getProjects(ws.id),
    getMembers(ws.id),
    getLabels(ws.id),
    getSavedViews(ws.id),
  ]);

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
      members={members}
      labels={labels}
      heading={activeProject ? activeProject.name : "All tasks"}
      defaultProjectId={activeProject?.id ?? null}
      savedViews={savedViews}
    />
  );
}
