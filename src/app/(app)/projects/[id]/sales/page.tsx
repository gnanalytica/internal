import { notFound } from "next/navigation";

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

export default async function ProjectSalesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const project = await getProject(ws.id, id);
  if (!project) notFound();
  if (!isDepartmentEnabled(project.enabledDepartments, "sales")) notFound();
  if (!canSeeConfidential(await getMyRole(ws.id))) return <Restricted label="Sales" />;

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
      heading={`${project.name} · Sales`}
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
