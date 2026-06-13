import { notFound } from "next/navigation";

import { IssueDetail } from "@/components/issue-detail";
import { isBlobConfigured } from "@/lib/blob";
import { isGithubConnected } from "@/lib/github";
import {
  getAttachments,
  getCyclesFlat,
  getBacklinks,
  getIssue,
  getIssueRelations,
  getIssuesFlat,
  getIssueTimeline,
  getLabels,
  getMembers,
  getMentionItems,
  getPagesFlat,
  getProjects,
  getTeamsFlat,
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
    teams,
    timeline,
    githubConnected,
    attachments,
    relations,
    allIssues,
  ] = await Promise.all([
    getIssue(ws.id, id),
    getProjects(ws.id),
    getMembers(ws.id),
    getLabels(ws.id),
    getPagesFlat(ws.id),
    getCyclesFlat(ws.id),
    getTeamsFlat(ws.id),
    getIssueTimeline(id),
    isGithubConnected(ws.id),
    getAttachments(id),
    getIssueRelations(ws.id, id),
    getIssuesFlat(ws.id),
  ]);
  if (!issue) notFound();
  const [favorited, mentionItems, backlinks] = await Promise.all([
    isFavorite(ws.id, "issue", id),
    getMentionItems(ws.id),
    getBacklinks(ws.id, "issue", id),
  ]);

  return (
    <IssueDetail
      issue={issue}
      projects={projects}
      members={members}
      labels={labels}
      allPages={pages}
      cycles={cycles}
      teams={teams}
      timeline={timeline}
      githubConnected={githubConnected}
      attachments={attachments}
      attachmentsEnabled={isBlobConfigured()}
      favorited={favorited}
      relations={relations}
      allIssues={allIssues}
      mentionItems={mentionItems}
      backlinks={backlinks}
    />
  );
}
