import { notFound } from "next/navigation";

import { IssueDetail } from "@/components/issue-detail";
import { isGithubConnected } from "@/lib/github";
import {
  getCyclesFlat,
  getBacklinks,
  getIssue,
  getIssueRelations,
  getIssuesFlat,
  getIssueTimeline,
  getLabels,
  getMembers,
  getMentionItems,
  getMilestones,
  getPagesFlat,
  getProjects,
  getWorkspace,
  isFavorite,
  isSubscribed,
} from "@/lib/data";

export default async function IssueRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const issuePromise = getIssue(ws.id, id);
  const [
    issue,
    projects,
    members,
    labels,
    pages,
    cycles,
    timeline,
    githubConnected,
    relations,
    allIssues,
    favorited,
    watching,
    mentionItems,
    backlinks,
    milestones,
  ] = await Promise.all([
    issuePromise,
    getProjects(ws.id),
    getMembers(ws.id),
    getLabels(ws.id),
    getPagesFlat(ws.id),
    getCyclesFlat(ws.id),
    getIssueTimeline(id),
    isGithubConnected(ws.id),
    getIssueRelations(ws.id, id),
    getIssuesFlat(ws.id),
    isFavorite(ws.id, "issue", id),
    isSubscribed(ws.id, "issue", id),
    getMentionItems(ws.id),
    getBacklinks(ws.id, "issue", id),
    // The only read that needs the issue: chained on it rather than waiting
    // for the whole batch.
    issuePromise.then((i) => (i?.projectId ? getMilestones(ws.id, i.projectId) : [])),
  ]);
  if (!issue) notFound();

  return (
    <IssueDetail
      issue={issue}
      projects={projects}
      members={members}
      labels={labels}
      allPages={pages}
      cycles={cycles}
      milestones={milestones.map((m) => ({ id: m.id, name: m.name }))}
      timeline={timeline}
      githubConnected={githubConnected}
      favorited={favorited}
      watching={watching}
      relations={relations}
      allIssues={allIssues}
      mentionItems={mentionItems}
      backlinks={backlinks}
    />
  );
}
