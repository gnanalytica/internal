import { notFound, redirect } from "next/navigation";

import { EngineeringView } from "@/components/engineering-view";
import { isDepartmentEnabled, issueBelongsToDepartment } from "@/lib/departments";
import { getCycles, getIssues, getProject, getWorkspace } from "@/lib/data";
import { getTaskContext } from "@/lib/task-context";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * A project's Engineering: the build board (Tasks) and the project's cycles
 * (Cycles), which used to be a project tab of their own.
 */
export default async function ProjectEngineeringPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const [project, allIssues, ctx, cycles, sp] = await Promise.all([
    getProject(ws.id, id),
    getIssues(ws.id),
    getTaskContext(ws.id),
    getCycles(ws.id, id),
    searchParams,
  ]);
  if (!project) notFound();
  const tab = first(sp.tab);
  if (!isDepartmentEnabled(project.enabledDepartments, "engineering")) {
    // A project without Engineering still has cycles: they keep their own page there.
    if (tab === "cycles") redirect(`/projects/${id}/cycles`);
    notFound();
  }

  const projectIssues = allIssues.filter((i) => i.projectId === id);
  // What velocity has left to chew through: this project's unfinished work,
  // weighted the way burndown weights it (no estimate = one point).
  const outstandingPoints = projectIssues
    .filter((i) => i.status !== "done" && i.status !== "canceled")
    .reduce((sum, i) => sum + (i.estimate ?? 1), 0);

  return (
    <EngineeringView
      heading={`${project.name} · Engineering`}
      projectId={id}
      // Engineering owns the build — app, AI/ML, platform and QA. Sales,
      // marketing and account-management work lives on those departments'
      // own surfaces; the whole set is still on the global board.
      issues={projectIssues.filter((i) => issueBelongsToDepartment(i.labels, "engineering"))}
      ctx={ctx}
      cycles={cycles}
      cadence={project.cycleCadence}
      outstandingPoints={outstandingPoints}
      nowISO={new Date().toISOString()}
      initialTab={tab}
    />
  );
}
