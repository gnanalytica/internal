import { notFound } from "next/navigation";

import { InitiativeDetail } from "@/components/initiative-detail";
import { getInitiative, getMyRole, getProjects, getWorkspace } from "@/lib/data";

export default async function InitiativeRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const initiative = await getInitiative(ws.id, id);
  if (!initiative) notFound();
  const [allProjects, role] = await Promise.all([
    getProjects(ws.id),
    getMyRole(ws.id),
  ]);

  return (
    <InitiativeDetail
      initiative={initiative}
      allProjects={allProjects}
      isAdmin={role === "admin"}
    />
  );
}
