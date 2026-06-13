import { notFound } from "next/navigation";

import { InitiativeDetail } from "@/components/initiative-detail";
import { getInitiative, getProjects, getWorkspace } from "@/lib/data";

export default async function InitiativeRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const initiative = await getInitiative(ws.id, id);
  if (!initiative) notFound();
  const allProjects = await getProjects(ws.id);

  return <InitiativeDetail initiative={initiative} allProjects={allProjects} />;
}
