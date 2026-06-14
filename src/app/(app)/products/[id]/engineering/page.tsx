import { notFound } from "next/navigation";

import { IssuesView } from "@/components/issues-view";
import {
  getIssues,
  getLabels,
  getMembers,
  getProduct,
  getProjects,
  getSavedViews,
  getWorkspace,
} from "@/lib/data";

export default async function ProductEngineeringPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const product = await getProduct(ws.id, id);
  if (!product) notFound();

  const [allIssues, projects, members, labels, savedViews] = await Promise.all([
    getIssues(ws.id),
    getProjects(ws.id),
    getMembers(ws.id),
    getLabels(ws.id),
    getSavedViews(ws.id),
  ]);

  return (
    <IssuesView
      initialIssues={allIssues.filter((i) => i.projectId === id)}
      projects={projects}
      members={members}
      labels={labels}
      heading={`${product.name} · Engineering`}
      defaultProjectId={id}
      savedViews={savedViews}
    />
  );
}
