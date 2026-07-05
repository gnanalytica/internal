import { notFound } from "next/navigation";

import { SurfacePlaceholder } from "@/components/surface-placeholder";
import { isDepartmentEnabled } from "@/lib/departments";
import { getProject, getWorkspace } from "@/lib/data";

export default async function ProjectRoadmapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const project = await getProject(ws.id, id);
  if (!project) notFound();
  if (!isDepartmentEnabled(project.enabledDepartments, "roadmap")) notFound();
  return <SurfacePlaceholder projectName={project.name} projectId={id} title="Roadmap" />;
}
