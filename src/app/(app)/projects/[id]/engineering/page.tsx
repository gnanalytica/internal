import { notFound } from "next/navigation";

import { EngineeringView } from "@/components/engineering-view";
import { isDepartmentEnabled, issueBelongsToDepartment } from "@/lib/departments";
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
      // Engineering owns the build — app, AI/ML, platform and QA. Sales,
      // marketing and account-management work lives on those departments'
      // own surfaces; the whole set is still on the global board.
      issues={allIssues.filter(
        (i) => i.projectId === id && issueBelongsToDepartment(i.labels, "engineering"),
      )}
      projects={projects}
      members={members}
      labels={labels}
      savedViews={savedViews}
      cycles={cycles}
    />
  );
}
