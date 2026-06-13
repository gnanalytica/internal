import { notFound } from "next/navigation";

import { PageView } from "@/components/page-view";
import { getIssuesFlat, getPage, getWorkspace } from "@/lib/data";

export default async function PageRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const page = await getPage(ws.id, id);
  if (!page) notFound();
  const allIssues = await getIssuesFlat(ws.id);

  return <PageView page={page} allIssues={allIssues} />;
}
