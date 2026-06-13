import { notFound } from "next/navigation";

import { IssueDetail } from "@/components/issue-detail";
import { isBlobConfigured } from "@/lib/blob";
import { isGithubConnected } from "@/lib/github";
import {
  getAttachments,
  getCyclesFlat,
  getIssue,
  getIssueTimeline,
  getLabels,
  getMembers,
  getPagesFlat,
  getProjects,
  getTeamsFlat,
  getWorkspace,
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
      teams={teams}
      timeline={timeline}
      githubConnected={githubConnected}
      attachments={attachments}
      attachmentsEnabled={isBlobConfigured()}
    />
  );
}
