import { notFound } from "next/navigation";

import { ProductView } from "@/components/product-view";
import { isDepartmentEnabled } from "@/lib/departments";
import { getFeatures, getFeedback, getIssues, getProject, getWorkspace } from "@/lib/data";
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
  const [issues, feedback, features] = await Promise.all([
    getIssues(ws.id),
    getFeedback(ws.id, id),
    getFeatures(ws.id, id),
  ]);

  // A feature's tickets can live in another project (an Engineering one), so
  // they are picked from the whole workspace by feature rather than by project.
  const featureIds = new Set(features.map((f) => f.id));

  return (
    <ProductView
      ctx={ctx}
      heading={`${project.name} · Product`}
      scopeProjectId={id}
      tickets={issues.filter((i) => i.featureId && featureIds.has(i.featureId))}
      features={features}
      feedback={feedback}
    />
  );
}
