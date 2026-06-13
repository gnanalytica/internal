import { notFound } from "next/navigation";

import { TeamDetail } from "@/components/team-detail";
import { getMembers, getMyRole, getTeam, getWorkspace } from "@/lib/data";

export default async function TeamRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const team = await getTeam(ws.id, id);
  if (!team) notFound();
  const [allMembers, role] = await Promise.all([
    getMembers(ws.id),
    getMyRole(ws.id),
  ]);

  return <TeamDetail team={team} allMembers={allMembers} isAdmin={role === "admin"} />;
}
