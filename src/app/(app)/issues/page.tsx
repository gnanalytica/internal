import { IssuesView } from "@/components/issues-view";
import {
  getIssues,
  getLabels,
  getMembers,
  getProjects,
  getWorkspace,
} from "@/lib/data";

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project: projectId } = await searchParams;
  const ws = await getWorkspace();
  const [allIssues, projects, members, labels] = await Promise.all([
    getIssues(ws.id),
    getProjects(ws.id),
    getMembers(ws.id),
    getLabels(ws.id),
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
      heading={activeProject ? activeProject.name : "All issues"}
      defaultProjectId={activeProject?.id ?? null}
    />
  );
}
