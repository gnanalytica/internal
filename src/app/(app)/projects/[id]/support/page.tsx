import { notFound } from "next/navigation";

import { SupportView } from "@/components/support-view";
import { isDepartmentEnabled } from "@/lib/departments";
import {
  getAccounts,
  getContacts,
  getMembers,
  getProject,
  getProjects,
  getTickets,
  getWorkspace,
} from "@/lib/data";

export default async function ProjectSupportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const project = await getProject(ws.id, id);
  if (!project) notFound();
  if (!isDepartmentEnabled(project.enabledDepartments, "support")) notFound();

  const [tickets, accounts, contacts, members, projects] = await Promise.all([
    getTickets(ws.id, id),
    getAccounts(ws.id),
    getContacts(ws.id),
    getMembers(ws.id),
    getProjects(ws.id),
  ]);

  return (
    <SupportView
      heading={`${project.name} · Support`}
      scopeProjectId={id}
      projects={projects}
      members={members}
      accounts={accounts}
      contacts={contacts}
      initialTickets={tickets}
    />
  );
}
