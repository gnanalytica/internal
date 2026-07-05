import { notFound } from "next/navigation";

import { VisionView } from "@/components/vision-view";
import { getProject, getWorkspace } from "@/lib/data";

/**
 * Per-product Vision tab. Renders a placeholder until a product's vision
 * (market sizing, positioning, GTM) is built.
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
