import { notFound } from "next/navigation";

import { ProspectsWorkspace } from "@/components/prospects-dashboard/workspace";
import { Restricted } from "@/components/restricted";
import { SalesView } from "@/components/sales-view";
import { loadCustomerSuccess } from "@/lib/customer-success-data";
import { canSeeConfidential, isDepartmentEnabled } from "@/lib/departments";
import { getDeals, getMyRole, getIssues, getProject, getWorkspace } from "@/lib/data";
import { loadProspectsWorkspace } from "@/lib/prospects/page-data";
import { PROSPECTS_PRODUCT_KEY } from "@/lib/prospects/schema";
import { getTaskContext } from "@/lib/task-context";

/**
 * The project's sales. For Valytica that is its prospects — the sheet the team
 * works every day — with each deal's value on its prospect's Pipeline card,
 * and (when Customer Success is on) the Customers tab: the prospects at Pilot
 * running or Won, with onboarding, requests and check-ins. Other products get
 * the deal board and their sales tasks.
 *
 * Admins only, as before. Customer Success used to be its own tab that members
 * could open too; it moved in here behind the same gate.
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
  // Both kinds of Sales page show the deals, so they go out with the gate's
  // reads; the gates below still decide whether anything renders.
  const [project, role, deals, sp] = await Promise.all([getProject(ws.id, id), getMyRole(ws.id), getDeals(ws.id, id), searchParams]);
  if (!project) notFound();
  if (!isDepartmentEnabled(project.enabledDepartments, "sales")) notFound();

  if (!canSeeConfidential(role)) return <Restricted label="Sales" />;

  if (project.key === PROSPECTS_PRODUCT_KEY) {
    const [data, customers] = await Promise.all([
      loadProspectsWorkspace(ws.id, sp.scope === "all" ? "all" : "focus"),
      isDepartmentEnabled(project.enabledDepartments, "customer-success")
        ? loadCustomerSuccess({ workspaceId: ws.id, projectId: id, fromSheet: true, showValue: true })
        : Promise.resolve(null),
    ]);
    return <ProspectsWorkspace data={data} deals={deals} customers={customers} />;
  }

  const [ctx, issues] = await Promise.all([getTaskContext(ws.id), getIssues(ws.id)]);
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
