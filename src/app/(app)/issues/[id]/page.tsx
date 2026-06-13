import { notFound } from "next/navigation";

import { IssueDetail } from "@/components/issue-detail";
import {
  getIssue,
  getLabels,
  getMembers,
  getPagesFlat,
  getProjects,
  getWorkspace,
} from "@/lib/data";

export default async function IssueRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const [issue, projects, members, labels, pages] = await Promise.all([
    getIssue(ws.id, id),
    getProjects(ws.id),
    getMembers(ws.id),
    getLabels(ws.id),
    getPagesFlat(ws.id),
  ]);
  if (!issue) notFound();

  return (
    <IssueDetail
      issue={issue}
      projects={projects}
      members={members}
      labels={labels}
      allPages={pages}
    />
  );
}
