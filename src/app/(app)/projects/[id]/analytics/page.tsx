import { notFound } from "next/navigation";

import { AnalyticsView } from "@/components/analytics-view";
import { isDepartmentEnabled } from "@/lib/departments";
import { getMetrics, getProject, getProjects, getWorkspace } from "@/lib/data";

export default async function ProjectAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const project = await getProject(ws.id, id);
  if (!project) notFound();
  if (!isDepartmentEnabled(project.enabledDepartments, "analytics")) notFound();

  const [metrics, projects] = await Promise.all([
    getMetrics(ws.id, id),
    getProjects(ws.id),
  ]);

  return (
    <AnalyticsView
      heading={`${project.name} · Analytics`}
      scopeProjectId={id}
      projects={projects}
      initialMetrics={metrics}
    />
  );
}
