import { notFound } from "next/navigation";

import { ProspectsView } from "@/components/prospects/prospects-view";
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
import { loadProspectsData } from "@/lib/sheet-crm/workspace-data";
import { getTaskContext } from "@/lib/task-context";

/**
 * The Sales surface is the Prospects workspace (the Valytica lead sheet, as
 * Internal reads and writes it). The deal board and sales tasks live behind
 * `?view=deals`: a real commercial opportunity is rarer than a prospect and
 * gets its own screen rather than a tab beside 5,000 people.
 */
export default async function ProjectSalesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const { view } = await searchParams;
  const ws = await getWorkspace();
  const project = await getProject(ws.id, id);
  if (!project) notFound();
  if (!isDepartmentEnabled(project.enabledDepartments, "sales")) notFound();

  if (view === "deals") {
    if (!canSeeConfidential(await getMyRole(ws.id))) return <Restricted label="Sales" />;
    const ctx = await getTaskContext(ws.id);
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

  const data = await loadProspectsData(ws.id);
  return <ProspectsView heading={`${project.name} · Prospects`} data={data} dealsHref={`/projects/${id}/sales?view=deals`} />;
}
