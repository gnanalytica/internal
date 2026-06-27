import { notFound } from "next/navigation";

import { SalesView } from "@/components/sales-view";
import { isDepartmentEnabled } from "@/lib/departments";
import {
  getAccounts,
  getContacts,
  getDeals,
  getMembers,
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

  const [deals, accounts, contacts, members, projects] = await Promise.all([
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
    />
  );
}
