import { notFound } from "next/navigation";

import { EngineeringView } from "@/components/engineering-view";
import { isDepartmentEnabled } from "@/lib/departments";
import {
  getCycles,
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

  const [allIssues, projects, members, labels, savedViews, cycles] = await Promise.all([
    getIssues(ws.id),
    getProjects(ws.id),
    getMembers(ws.id),
    getLabels(ws.id),
    getSavedViews(ws.id),
    getCycles(ws.id, id),
  ]);

  return (
    <EngineeringView
      heading={`${project.name} · Engineering`}
      projectId={id}
      issues={allIssues.filter((i) => i.projectId === id)}
      projects={projects}
      members={members}
      labels={labels}
      savedViews={savedViews}
      cycles={cycles}
    />
  );
}
