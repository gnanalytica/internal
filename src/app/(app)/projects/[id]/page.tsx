import { notFound } from "next/navigation";

import { ProjectDetail } from "@/components/project-detail";
import {
  getMembers,
  getMyRole,
  getProject,
  getWorkspace,
} from "@/lib/data";

export default async function ProjectRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const project = await getProject(ws.id, id);
  if (!project) notFound();
  const [members, role] = await Promise.all([
    getMembers(ws.id),
    getMyRole(ws.id),
  ]);

  return (
    <ProjectDetail
      project={project}
      members={members}
      isAdmin={role === "admin"}
    />
  );
}
