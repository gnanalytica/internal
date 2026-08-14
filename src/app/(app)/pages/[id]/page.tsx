import { notFound } from "next/navigation";

import { PageView } from "@/components/page-view";
import { isAiConfigured } from "@/lib/ai";
import {
  getBacklinks,
  getIssuesFlat,
  getMembers,
  getMentionItems,
  getPage,
  getPageComments,
  getPageVersions,
  getWorkspace,
  isFavorite,
  isSubscribed,
} from "@/lib/data";

export default async function PageRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const page = await getPage(ws.id, id);
  if (!page) notFound();
  const [allIssues, favorited, watching, mentionItems, backlinks, comments, versions, members] =
    await Promise.all([
      getIssuesFlat(ws.id),
      isFavorite(ws.id, "page", id),
      isSubscribed(ws.id, "page", id),
      getMentionItems(ws.id),
      getBacklinks(ws.id, "page", id),
      getPageComments(ws.id, id),
      getPageVersions(ws.id, id),
      getMembers(ws.id),
    ]);

  return (
    <PageView
      page={page}
      allIssues={allIssues}
      favorited={favorited}
      watching={watching}
      mentionItems={mentionItems}
      backlinks={backlinks}
      comments={comments}
      versions={versions}
      members={members}
      aiEnabled={isAiConfigured()}
    />
  );
}
