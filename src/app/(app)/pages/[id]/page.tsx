import { notFound } from "next/navigation";

import { PageView } from "@/components/page-view";
import {
  getBacklinks,
  getIssuesFlat,
  getMentionItems,
  getPage,
  getWorkspace,
  isFavorite,
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
  const [allIssues, favorited, mentionItems, backlinks] = await Promise.all([
    getIssuesFlat(ws.id),
    isFavorite(ws.id, "page", id),
    getMentionItems(ws.id),
    getBacklinks(ws.id, "page", id),
  ]);

  return (
    <PageView
      page={page}
      allIssues={allIssues}
      favorited={favorited}
      mentionItems={mentionItems}
      backlinks={backlinks}
    />
  );
}
