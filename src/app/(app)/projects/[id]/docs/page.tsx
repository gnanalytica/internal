import { notFound } from "next/navigation";

import { DocsView } from "@/components/docs-view";
import { canSeeConfidential } from "@/lib/departments";
import { getMyRole, getPageTree, getProject, getWorkspace } from "@/lib/data";
import { Restricted } from "@/components/restricted";

export default async function ProjectDocsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const project = await getProject(ws.id, id);
  if (!project) notFound();
  if (project.confidential && !canSeeConfidential(await getMyRole(ws.id))) {
    return <Restricted label={project.name} />;
  }

  const tree = await getPageTree(ws.id, id);
  return <DocsView projectId={id} heading={`${project.name} · Docs`} tree={tree} />;
}
