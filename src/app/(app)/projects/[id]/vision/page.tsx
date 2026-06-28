import { notFound } from "next/navigation";

import { VisionView } from "@/components/vision-view";
import { getProject, getWorkspace } from "@/lib/data";

/**
 * Per-product Vision tab. The strategy dashboard content is currently
 * Valytica-specific (key=VAL); other products render the placeholder.
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

  return <VisionView projectName={project.name} projectId={id} hasContent={project.key === "VAL"} />;
}
