import { Restricted } from "@/components/restricted";
import { SalesView } from "@/components/sales-view";
import { canSeeConfidential } from "@/lib/departments";
import {
  getAccounts,
  getContacts,
  getDeals,
  getMembers,
  getMyRole,
  getProjects,
  getWorkspace,
} from "@/lib/data";

export default async function SalesPage() {
  const ws = await getWorkspace();
  if (!canSeeConfidential(await getMyRole(ws.id))) return <Restricted label="Sales" />;
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
