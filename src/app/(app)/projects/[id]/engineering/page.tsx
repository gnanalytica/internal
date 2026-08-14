import { notFound } from "next/navigation";

import { EngineeringView } from "@/components/engineering-view";
import { isDepartmentEnabled, issueBelongsToDepartment } from "@/lib/departments";
import { getCycles, getIssues, getProject, getWorkspace } from "@/lib/data";
import { getTaskContext } from "@/lib/task-context";

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

  const [allIssues, ctx, cycles] = await Promise.all([
    getIssues(ws.id),
    getTaskContext(ws.id),
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
      ctx={ctx}
      cycles={cycles}
    />
  );
}
