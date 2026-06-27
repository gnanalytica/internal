import { notFound } from "next/navigation";

import { IssueDetail } from "@/components/issue-detail";
import { isGithubConnected } from "@/lib/github";
import {
  getCyclesFlat,
  getBacklinks,
  getFeatures,
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
} from "@/lib/data";

export default async function IssueRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
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
    features,
  ] = await Promise.all([
    getIssue(ws.id, id),
    getProjects(ws.id),
    getMembers(ws.id),
    getLabels(ws.id),
    getPagesFlat(ws.id),
    getCyclesFlat(ws.id),
    getIssueTimeline(id),
    isGithubConnected(ws.id),
    getIssueRelations(ws.id, id),
    getIssuesFlat(ws.id),
    getFeatures(ws.id),
  ]);
  if (!issue) notFound();
  const [favorited, mentionItems, backlinks, milestones] = await Promise.all([
    isFavorite(ws.id, "issue", id),
    getMentionItems(ws.id),
    getBacklinks(ws.id, "issue", id),
    issue.projectId ? getMilestones(ws.id, issue.projectId) : Promise.resolve([]),
  ]);

  return (
    <IssueDetail
      issue={issue}
      projects={projects}
      members={members}
      labels={labels}
      allPages={pages}
      cycles={cycles}
      features={features.map((f) => ({ id: f.id, title: f.title }))}
      milestones={milestones.map((m) => ({ id: m.id, name: m.name }))}
      timeline={timeline}
      githubConnected={githubConnected}
      favorited={favorited}
      relations={relations}
      allIssues={allIssues}
      mentionItems={mentionItems}
      backlinks={backlinks}
    />
  );
}
