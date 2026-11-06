import { notFound } from "next/navigation";

import { ProjectTabs } from "@/components/project-tabs";
import { canSeeConfidential } from "@/lib/departments";
import {
  getCurrentUser,
  getMyRole,
  getProject,
  getWorkspace,
  isSubscribed,
} from "@/lib/data";

export default async function ProjectLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  // Independent once the workspace is known — one round of lookups, not four.
  const [project, role, me, watching] = await Promise.all([
    getProject(ws.id, id),
    getMyRole(ws.id),
    getCurrentUser(ws.id),
    isSubscribed(ws.id, "project", id),
  ]);
  if (!project) notFound();
  const isAdmin = canSeeConfidential(role);
  const isOwner = project.ownerId === me.id;

  return (
    <div className="flex h-full flex-col">
      {/* Projects show department tabs; operations show Overview + Docs. */}
      <ProjectTabs
        project={{
          id: project.id,
          name: project.name,
          color: project.color,
          kind: project.kind,
          enabledDepartments: project.enabledDepartments,
        }}
        isAdmin={isAdmin}
        isOwner={isOwner}
        watching={watching}
      />
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
