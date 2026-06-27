import { notFound } from "next/navigation";

import { FeaturesView } from "@/components/features-view";
import { isDepartmentEnabled } from "@/lib/departments";
import { getFeatures, getProject, getWorkspace } from "@/lib/data";

export default async function ProjectFeaturesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const project = await getProject(ws.id, id);
  if (!project) notFound();
  if (!isDepartmentEnabled(project.enabledDepartments, "features")) notFound();

  const features = await getFeatures(ws.id, id);

  return (
    <FeaturesView
      heading={`${project.name} · Product`}
      features={features}
      nowISO={new Date().toISOString()}
      scopeProjectId={id}
    />
  );
}
