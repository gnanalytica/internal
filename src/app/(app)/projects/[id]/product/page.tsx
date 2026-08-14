import { notFound } from "next/navigation";

import { ProductView } from "@/components/product-view";
import { isDepartmentEnabled } from "@/lib/departments";
import { getFeedback, getIssues, getMilestones, getProject, getWorkspace } from "@/lib/data";
import { getTaskContext } from "@/lib/task-context";

export default async function ProjectProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const project = await getProject(ws.id, id);
  if (!project) notFound();
  if (!isDepartmentEnabled(project.enabledDepartments, "product")) notFound();

  const ctx = await getTaskContext(ws.id);
  const [issues, feedback, milestones] = await Promise.all([
    getIssues(ws.id),
    getFeedback(ws.id, id),
    getMilestones(ws.id, id),
  ]);

  return (
    <ProductView
      ctx={ctx}
      heading={`${project.name} · Product`}
      scopeProjectId={id}
      issues={issues.filter((i) => i.projectId === id)}
      feedback={feedback}
      milestones={milestones}
    />
  );
}
