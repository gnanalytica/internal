import { notFound } from "next/navigation";

import { MarketingWorkspace } from "@/components/marketing/workspace";
import { isDepartmentEnabled } from "@/lib/departments";
import { getContentItems, getMembers, getProject, getWorkspace } from "@/lib/data";
import { todayIST } from "@/lib/marketing";
import { PROSPECTS_PRODUCT_KEY } from "@/lib/prospects/schema";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * The project's marketing: its content pieces on a calendar, in a table and
 * by channel. Campaigns still exist (the API reads them) but this page plans
 * by piece, not by campaign.
 */
export default async function ProjectMarketingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const project = await getProject(ws.id, id);
  if (!project) notFound();
  if (!isDepartmentEnabled(project.enabledDepartments, "marketing")) notFound();

  const sp = await searchParams;
  const [content, members] = await Promise.all([getContentItems(ws.id, id), getMembers(ws.id)]);
  // Leads from marketing land in Sales: Valytica's prospects list, or the deal board elsewhere.
  const salesHref = isDepartmentEnabled(project.enabledDepartments, "sales")
    ? `/projects/${id}/sales${project.key === PROSPECTS_PRODUCT_KEY ? "?tab=list" : ""}`
    : null;

  return (
    <MarketingWorkspace
      projectId={id}
      items={content}
      members={members}
      today={todayIST()}
      salesHref={salesHref}
      initialTab={first(sp.tab)}
      initialPiece={first(sp.piece)}
    />
  );
}
