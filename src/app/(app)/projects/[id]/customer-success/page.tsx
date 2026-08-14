import { notFound } from "next/navigation";

import { SupportView } from "@/components/support-view";
import { isDepartmentEnabled } from "@/lib/departments";
import {
  getAccounts,
  getContacts,
  getMembers,
  getIssues,
  getProject,
  getProjects,
  getTickets,
  getWorkspace,
} from "@/lib/data";
import { getTaskContext } from "@/lib/task-context";

export default async function ProjectSupportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const project = await getProject(ws.id, id);
  if (!project) notFound();
  if (!isDepartmentEnabled(project.enabledDepartments, "customer-success")) notFound();

  const ctx = await getTaskContext(ws.id);
  const [issues, tickets, accounts, contacts, members, projects] = await Promise.all([
    getIssues(ws.id),
    getTickets(ws.id, id),
    getAccounts(ws.id),
    getContacts(ws.id),
    getMembers(ws.id),
    getProjects(ws.id),
  ]);

  return (
    <SupportView
      ctx={ctx}
      heading={`${project.name} · Customer Success`}
      scopeProjectId={id}
      projects={projects}
      members={members}
      accounts={accounts}
      contacts={contacts}
      initialTickets={tickets}
      issues={issues.filter((i) => i.projectId === id)}
    />
  );
}
