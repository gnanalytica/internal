import { notFound } from "next/navigation";

import { ValyticaMarketDashboard } from "@/components/valytica-market-dashboard";
import { getProject, getWorkspace } from "@/lib/data";

/**
 * Valytica's Market & Strategy dashboard. The content is Valytica-specific, so
 * the route (and the tab in ProjectTabs) is gated to the Valytica project (VAL).
 */
export default async function ProjectMarketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const project = await getProject(ws.id, id);
  if (!project || project.key !== "VAL") notFound();

  return <ValyticaMarketDashboard projectName={project.name} projectId={id} />;
}
