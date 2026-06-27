import { notFound } from "next/navigation";

import { ProductView } from "@/components/product-view";
import { isDepartmentEnabled } from "@/lib/departments";
import { getFeatures, getFeedback, getProject, getWorkspace } from "@/lib/data";

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

  const [features, feedback] = await Promise.all([
    getFeatures(ws.id, id),
    getFeedback(ws.id, id),
  ]);

  return (
    <ProductView
      heading={`${project.name} · Product`}
      scopeProjectId={id}
      features={features}
      nowISO={new Date().toISOString()}
      feedback={feedback}
    />
  );
}
