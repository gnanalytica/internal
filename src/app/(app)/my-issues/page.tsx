import { IssuesView } from "@/components/issues-view";
import {
  getCurrentUser,
  getIssues,
  getLabels,
  getMembers,
  getProjects,
  getSavedViews,
  getWorkspace,
} from "@/lib/data";

export default async function MyIssuesPage() {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);
  const [allIssues, projects, members, labels, savedViews] = await Promise.all([
    getIssues(ws.id),
    getProjects(ws.id),
    getMembers(ws.id),
    getLabels(ws.id),
    getSavedViews(ws.id),
  ]);

  // Issues where I'm the primary assignee or one of the co-assignees.
  const mine = allIssues.filter(
    (i) => i.assigneeId === me.id || i.assignees.some((a) => a.id === me.id),
  );

  return (
    <IssuesView
      initialIssues={mine}
      projects={projects}
      members={members}
      labels={labels}
      heading="My Issues"
      defaultProjectId={null}
      savedViews={savedViews}
    />
  );
}
