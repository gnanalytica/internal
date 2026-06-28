import { notFound } from "next/navigation";

import { MarketingView } from "@/components/marketing-view";
import { isDepartmentEnabled } from "@/lib/departments";
import {
  getCampaigns,
  getContentItems,
  getProject,
  getProjects,
  getWorkspace,
} from "@/lib/data";

export default async function ProjectMarketingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const project = await getProject(ws.id, id);
  if (!project) notFound();
  if (!isDepartmentEnabled(project.enabledDepartments, "marketing")) notFound();

  const [campaigns, content, projects] = await Promise.all([
    getCampaigns(ws.id, id),
    getContentItems(ws.id, id),
    getProjects(ws.id),
  ]);

  return (
    <MarketingView
      heading={`${project.name} · Marketing`}
      scopeProjectId={id}
      projects={projects}
      initialCampaigns={campaigns}
      initialContent={content}
      showMarket={project.key === "VAL"}
    />
  );
}
