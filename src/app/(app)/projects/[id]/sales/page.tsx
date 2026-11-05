import { notFound } from "next/navigation";

import { DepartmentTasks } from "@/components/department-tasks";
import { ProspectsWorkspace } from "@/components/prospects-dashboard/workspace";
import { Restricted } from "@/components/restricted";
import { SalesView } from "@/components/sales-view";
import { canSeeConfidential, isDepartmentEnabled } from "@/lib/departments";
import {
  getAccounts,
  getContacts,
  getDeals,
  getMembers,
  getMyRole,
  getIssues,
  getProject,
  getProjects,
  getWorkspace,
} from "@/lib/data";
import { loadProspectsWorkspace } from "@/lib/prospects/page-data";
import { PROSPECTS_PRODUCT_KEY } from "@/lib/prospects/schema";
import { getTaskContext } from "@/lib/task-context";

/**
 * The project's sales. For Valytica that is its prospects — the sheet the team
 * works every day — with the deals they turn into and the sales tasks beside
 * them. Other products get the deal board, accounts and contacts.
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
  const project = await getProject(ws.id, id);
  if (!project) notFound();
  if (!isDepartmentEnabled(project.enabledDepartments, "sales")) notFound();

  if (!canSeeConfidential(await getMyRole(ws.id))) return <Restricted label="Sales" />;
  const ctx = await getTaskContext(ws.id);

  if (project.key === PROSPECTS_PRODUCT_KEY) {
    const sp = await searchParams;
    const [data, deals, issues] = await Promise.all([
      loadProspectsWorkspace(ws.id, sp.scope === "all" ? "all" : "focus"),
      getDeals(ws.id, id),
      getIssues(ws.id),
    ]);
    return (
      <ProspectsWorkspace
        data={data}
        deals={deals}
        tasks={
          <DepartmentTasks
            issues={issues.filter((i) => i.projectId === id)}
            department="sales"
            ctx={ctx}
            projectId={id}
            emptyLabel="No sales tasks yet."
          />
        }
      />
    );
  }

  const [issues, deals, accounts, contacts, members, projects] = await Promise.all([
    getIssues(ws.id),
    getDeals(ws.id, id),
    getAccounts(ws.id),
    getContacts(ws.id),
    getMembers(ws.id),
    getProjects(ws.id),
  ]);
  return (
    <SalesView
      ctx={ctx}
      heading={`${project.name} · Deals`}
      scopeProjectId={id}
      projects={projects}
      members={members}
      initialDeals={deals}
      initialAccounts={accounts}
      initialContacts={contacts}
      issues={issues.filter((i) => i.projectId === id)}
    />
  );
}
