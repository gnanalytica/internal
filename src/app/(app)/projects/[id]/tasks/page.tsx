import { notFound } from "next/navigation";

import { IssuesView } from "@/components/issues-view";
import { Restricted } from "@/components/restricted";
import { canSeeConfidential } from "@/lib/departments";
import { getIssues, getMyRole, getProject, getWorkspace } from "@/lib/data";
import { getTaskContext } from "@/lib/task-context";

/**
 * An operation's Tasks surface: the full filter/group/board issue tooling scoped
 * to this operation. Lets Legal, Finance, People & HR, etc. manage their typed
 * tasks (legal, finance, people, …) without engineering departments.
 */
export default async function ProjectTasksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  // The gate below only decides what renders; the reads are cached and cheap,
  // so they go out together rather than one after another.
  const [project, role, allIssues, ctx] = await Promise.all([
    getProject(ws.id, id),
    getMyRole(ws.id),
    getIssues(ws.id),
    getTaskContext(ws.id),
  ]);
  if (!project) notFound();

  // Confidential operations (Finance, People & HR) are founders-only.
  if (project.confidential && !canSeeConfidential(role)) {
    return <Restricted label={project.name} />;
  }

  return (
    <IssuesView
      embedded
      heading="Tasks"
      initialIssues={allIssues.filter((i) => i.projectId === id)}
      defaultProjectId={id}
      projects={ctx.projects}
      members={ctx.members}
      labels={ctx.labels}
      savedViews={ctx.savedViews}
      cycles={ctx.cycles}
      milestones={ctx.milestones}
      blockedIds={ctx.blockedIds}
    />
  );
}
