import { notFound } from "next/navigation";

import { IssuesView } from "@/components/issues-view";
import { isDepartmentEnabled } from "@/lib/departments";
import {
  getIssues,
  getLabels,
  getMembers,
  getProject,
  getProjects,
  getSavedViews,
  getWorkspace,
} from "@/lib/data";

export default async function ProjectEngineeringPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const project = await getProject(ws.id, id);
  if (!project) notFound();
  if (!isDepartmentEnabled(project.enabledDepartments, "engineering")) notFound();

  const [allIssues, projects, members, labels, savedViews] = await Promise.all([
    getIssues(ws.id),
    getProjects(ws.id),
    getMembers(ws.id),
    getLabels(ws.id),
    getSavedViews(ws.id),
  ]);

  return (
    <IssuesView
      initialIssues={allIssues.filter((i) => i.projectId === id)}
      projects={projects}
      members={members}
      labels={labels}
      heading={`${project.name} · Engineering`}
      defaultProjectId={id}
      savedViews={savedViews}
    />
  );
}
