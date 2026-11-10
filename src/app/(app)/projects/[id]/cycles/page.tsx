import { notFound, redirect } from "next/navigation";

import { CyclesView } from "@/components/cycles-view";
import { Topbar } from "@/components/topbar";
import { isDepartmentEnabled, projectCyclesHref } from "@/lib/departments";
import { getCycles, getIssues, getProject, getWorkspace } from "@/lib/data";

/**
 * A project's cycles. They are the Cycles view inside Engineering now, so old
 * links land there. A project without Engineering has nowhere to nest them,
 * so this page still renders them on their own for it.
 */
export default async function ProjectCyclesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const [project, cycles, allIssues] = await Promise.all([
    getProject(ws.id, id),
    getCycles(ws.id, id),
    getIssues(ws.id),
  ]);
  if (!project) notFound();
  if (project.kind === "project" && isDepartmentEnabled(project.enabledDepartments, "engineering")) {
    redirect(projectCyclesHref(id));
  }

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
        />
      </div>
    </div>
  );
}
