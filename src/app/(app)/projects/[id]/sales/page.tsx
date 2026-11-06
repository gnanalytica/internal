import { notFound } from "next/navigation";

import { ProspectsWorkspace } from "@/components/prospects-dashboard/workspace";
import { Restricted } from "@/components/restricted";
import { SalesView } from "@/components/sales-view";
import { canSeeConfidential, isDepartmentEnabled } from "@/lib/departments";
import { getDeals, getMyRole, getIssues, getProject, getWorkspace } from "@/lib/data";
import { loadProspectsWorkspace } from "@/lib/prospects/page-data";
import { PROSPECTS_PRODUCT_KEY } from "@/lib/prospects/schema";
import { getTaskContext } from "@/lib/task-context";

/**
 * The project's sales. For Valytica that is its prospects — the sheet the team
 * works every day — with the deals they turn into beside them. Other products
 * get the deal board and their sales tasks.
 */
export default async function ProjectSalesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const [project, role] = await Promise.all([getProject(ws.id, id), getMyRole(ws.id)]);
  if (!project) notFound();
  if (!isDepartmentEnabled(project.enabledDepartments, "sales")) notFound();

  if (!canSeeConfidential(role)) return <Restricted label="Sales" />;

  if (project.key === PROSPECTS_PRODUCT_KEY) {
    const sp = await searchParams;
    const [data, deals] = await Promise.all([
      loadProspectsWorkspace(ws.id, sp.scope === "all" ? "all" : "focus"),
      getDeals(ws.id, id),
    ]);
    return <ProspectsWorkspace data={data} deals={deals} />;
  }

  const [ctx, issues, deals] = await Promise.all([
    getTaskContext(ws.id),
    getIssues(ws.id),
    getDeals(ws.id, id),
  ]);
  return (
    <SalesView
      ctx={ctx}
      heading={`${project.name} · Deals`}
      scopeProjectId={id}
      // The task context already carries the workspace's projects and members.
      projects={ctx.projects}
      members={ctx.members}
      initialDeals={deals}
      issues={issues.filter((i) => i.projectId === id)}
    />
  );
}
