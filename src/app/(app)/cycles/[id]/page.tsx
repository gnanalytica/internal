import { notFound } from "next/navigation";

import { CycleDetail } from "@/components/cycle-detail";
import { getCycle, getMembers, getWorkspace } from "@/lib/data";

export default async function CycleRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const cycle = await getCycle(ws.id, id);
  if (!cycle) notFound();
  const members = await getMembers(ws.id);

  return <CycleDetail cycle={cycle} members={members} />;
}
