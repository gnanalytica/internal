import { AnalyticsView } from "@/components/analytics-view";
import { getMetrics, getProjects, getWorkspace } from "@/lib/data";

export default async function AnalyticsPage() {
  const ws = await getWorkspace();
  const [metrics, projects] = await Promise.all([
    getMetrics(ws.id),
    getProjects(ws.id),
  ]);
  return (
    <AnalyticsView
      heading="Analytics · all projects"
      scopeProjectId={null}
      projects={projects}
      initialMetrics={metrics}
      groupByProject
    />
  );
}
