import { notFound } from "next/navigation";

import { IssuesView } from "@/components/issues-view";
import { Restricted } from "@/components/restricted";
import { canSeeConfidential } from "@/lib/departments";
import {
  getIssues,
  getLabels,
  getMembers,
  getMyRole,
  getProject,
  getProjects,
  getSavedViews,
  getWorkspace,
} from "@/lib/data";

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
  const project = await getProject(ws.id, id);
  if (!project) notFound();

  // Confidential operations (Finance, People & HR) are founders-only.
  if (project.confidential && !canSeeConfidential(await getMyRole(ws.id))) {
    return <Restricted label={project.name} />;
  }

  const [allIssues, projects, members, labels, savedViews] = await Promise.all([
    getIssues(ws.id),
    getProjects(ws.id),
    getMembers(ws.id),
    getLabels(ws.id),
    getSavedViews(ws.id),
  ]);

  return (
    <IssuesView
      embedded
      heading="Tasks"
      initialIssues={allIssues.filter((i) => i.projectId === id)}
      defaultProjectId={id}
      projects={projects}
      members={members}
      labels={labels}
      savedViews={savedViews}
    />
  );
}
