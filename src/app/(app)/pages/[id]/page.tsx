import { notFound } from "next/navigation";

import { PageView } from "@/components/page-view";
import { getIssuesFlat, getPage, getWorkspace, isFavorite } from "@/lib/data";

export default async function PageRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const page = await getPage(ws.id, id);
  if (!page) notFound();
  const [allIssues, favorited] = await Promise.all([
    getIssuesFlat(ws.id),
    isFavorite(ws.id, "page", id),
  ]);

  return <PageView page={page} allIssues={allIssues} favorited={favorited} />;
}
