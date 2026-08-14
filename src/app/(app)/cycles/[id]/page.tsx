import { notFound } from "next/navigation";

import { CycleDetail } from "@/components/cycle-detail";
import { computeBurndown } from "@/lib/burndown";
import { getCycle, getWorkspace } from "@/lib/data";
import { getTaskContext } from "@/lib/task-context";

export default async function CycleRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const cycle = await getCycle(ws.id, id);
  if (!cycle) notFound();
  const ctx = await getTaskContext(ws.id);

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
      ctx={ctx}
      burndownPoints={burndown.points}
      totalPoints={burndown.totalPoints}
    />
  );
}
