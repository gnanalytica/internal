import { notFound } from "next/navigation";

import { VisionView } from "@/components/vision-view";
import { getProject, getWorkspace } from "@/lib/data";

/**
 * Per-product Vision tab. Valytica (VAL) shows the valuation strategy and Atlas
 * (ATL) the feasibility strategy; other products render the placeholder.
 */
export default async function ProjectVisionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const project = await getProject(ws.id, id);
  if (!project || project.kind !== "project") notFound();

  return <VisionView projectName={project.name} projectId={id} productKey={project.key} />;
}
