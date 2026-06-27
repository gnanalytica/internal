import { notFound } from "next/navigation";

import { ProjectTabs } from "@/components/project-tabs";
import { canSeeConfidential } from "@/lib/departments";
import { getMyRole, getProject, getWorkspace } from "@/lib/data";

export default async function ProjectLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const project = await getProject(ws.id, id);
  if (!project) notFound();
  const isAdmin = canSeeConfidential(await getMyRole(ws.id));

  return (
    <div className="flex h-full flex-col">
      {/* Department tabs only apply to projects; operations render flat. */}
      {project.kind === "project" && <ProjectTabs project={project} isAdmin={isAdmin} />}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
