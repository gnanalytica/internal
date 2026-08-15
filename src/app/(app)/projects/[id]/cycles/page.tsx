import { notFound } from "next/navigation";

import { CyclesView } from "@/components/cycles-view";
import { Topbar } from "@/components/topbar";
import { getCycles, getIssues, getProject, getWorkspace } from "@/lib/data";

/**
 * A project's cycles: the cadence, velocity, and every sprint.
 *
 * Its own surface rather than a tab inside Engineering — a cycle is the whole
 * project's rhythm, not an engineering sub-concern, and burying it two clicks
 * deep made the one thing you check every Monday the hardest thing to reach.
 */
export default async function ProjectCyclesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const project = await getProject(ws.id, id);
  if (!project) notFound();

  const [cycles, allIssues] = await Promise.all([
    getCycles(ws.id, id),
    getIssues(ws.id),
  ]);

  // What velocity has left to chew through: this project's unfinished work,
  // weighted the way burndown weights it (no estimate = one point).
  const outstandingPoints = allIssues
    .filter((i) => i.projectId === id && i.status !== "done" && i.status !== "canceled")
    .reduce((sum, i) => sum + (i.estimate ?? 1), 0);

  return (
    <div className="flex h-full flex-col">
      <Topbar breadcrumb={[{ label: `${project.name} · Cycles` }]} />
      <div className="min-h-0 flex-1">
        <CyclesView
          cycles={cycles}
          projectId={id}
          cadence={project.cycleCadence}
          outstandingPoints={outstandingPoints}
          nowISO={new Date().toISOString()}
          embedded
        />
      </div>
    </div>
  );
}
