import { SupportView } from "@/components/support-view";
import {
  getAccounts,
  getContacts,
  getMembers,
  getProjects,
  getTickets,
  getWorkspace,
} from "@/lib/data";

export default async function SupportPage() {
  const ws = await getWorkspace();
  const [tickets, accounts, contacts, members, projects] = await Promise.all([
    getTickets(ws.id),
    getAccounts(ws.id),
    getContacts(ws.id),
    getMembers(ws.id),
    getProjects(ws.id),
  ]);

  return (
    <SupportView
      heading="Customer Success · all projects"
      scopeProjectId={null}
      projects={projects}
      members={members}
      accounts={accounts}
      contacts={contacts}
      initialTickets={tickets}
    />
  );
}
