import { notFound } from "next/navigation";

import { ProspectsWorkspace } from "@/components/prospects-dashboard/workspace";
import { Restricted } from "@/components/restricted";
import { SalesView } from "@/components/sales-view";
import { loadCustomerSuccess } from "@/lib/customer-success-data";
import { canSeeDepartment, isDepartmentEnabled } from "@/lib/departments";
import { getDeals, getMembers, getMyRole, getProject, getProjects, getWorkspace } from "@/lib/data";
import { loadProspectsWorkspace } from "@/lib/prospects/page-data";
import { PROSPECTS_PRODUCT_KEY } from "@/lib/prospects/schema";

/**
 * The project's sales. For Valytica that is its prospects — the sheet the team
 * works every day — with the Deals tab, each deal's value on its prospect's
 * card on the stage board, and (when Customer Success is on) the Customers tab: the prospects at Pilot
 * running or Won, with onboarding, requests and check-ins. Other products get
 * the deal board — only Product and Engineering keep tasks.
 *
 * Who may open it is the one department rule (`canSeeDepartment("sales")`),
 * the same one the tab strip uses; the Customers tab follows it too.
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

  if (!canSeeDepartment("sales", role)) return <Restricted label="Sales" />;

  if (project.key === PROSPECTS_PRODUCT_KEY) {
    const [data, customers] = await Promise.all([
      loadProspectsWorkspace(ws.id, sp.scope === "all" ? "all" : "focus"),
      isDepartmentEnabled(project.enabledDepartments, "customer-success")
        ? // Anyone past the Sales gate sees deal values on Pipeline, so on customers too.
          loadCustomerSuccess({ workspaceId: ws.id, projectId: id })
        : Promise.resolve(null),
    ]);
    return <ProspectsWorkspace data={data} deals={deals} customers={customers} />;
  }

  // Just the deal board: tasks belong to Product and Engineering, so nothing
  // here loads issues. Any `?tab=` (an old `?tab=tasks` link) lands on the board.
  const [projects, members] = await Promise.all([getProjects(ws.id), getMembers(ws.id)]);
  return (
    <SalesView
      heading={`${project.name} · Deals`}
      scopeProjectId={id}
      projects={projects}
      members={members}
      initialDeals={deals}
    />
  );
}
