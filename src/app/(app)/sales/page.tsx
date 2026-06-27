import { SalesView } from "@/components/sales-view";
import {
  getAccounts,
  getContacts,
  getDeals,
  getMembers,
  getProjects,
  getWorkspace,
} from "@/lib/data";

export default async function SalesPage() {
  const ws = await getWorkspace();
  const [deals, accounts, contacts, members, projects] = await Promise.all([
    getDeals(ws.id),
    getAccounts(ws.id),
    getContacts(ws.id),
    getMembers(ws.id),
    getProjects(ws.id),
  ]);

  return (
    <SalesView
      heading="Sales · all projects"
      scopeProjectId={null}
      projects={projects}
      members={members}
      initialDeals={deals}
      initialAccounts={accounts}
      initialContacts={contacts}
    />
  );
}
