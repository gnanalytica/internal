import { notFound } from "next/navigation";

import { CycleDetail } from "@/components/cycle-detail";
import { computeBurndown } from "@/lib/burndown";
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

  const burndown = computeBurndown({
    issues: cycle.issues.map((i) => ({
      id: i.id,
      estimate: i.estimate,
      createdAt: i.createdAt,
    })),
    doneEvents: cycle.doneEvents,
    start: cycle.startDate,
    end: cycle.endDate,
    now: new Date(),
  });

  return (
    <CycleDetail
      cycle={cycle}
      members={members}
      burndownPoints={burndown.points}
      totalPoints={burndown.totalPoints}
    />
  );
}
