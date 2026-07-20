import { OrgView } from "@/components/org-view";
import {
  getMembersWithRole,
  getMyRole,
  getOrgRoles,
  getProjects,
  getWorkspace,
} from "@/lib/data";

/**
 * Company-wide organization page: the operating model (builder/strategist
 * split), who wears which hat per product, and the org chart. Visible to every
 * member — unlike People & HR, nothing here is confidential (titles and names
 * only; HR fields stay in the People & HR operation).
 */
export default async function OrgPage() {
  const ws = await getWorkspace();
  const [members, orgRoles, projects, role] = await Promise.all([
    getMembersWithRole(ws.id),
    getOrgRoles(ws.id),
    getProjects(ws.id),
    getMyRole(ws.id),
  ]);
  return (
    <OrgView
      members={members}
      orgRoles={orgRoles}
      products={projects.filter((p) => p.kind === "project")}
      isAdmin={role === "admin"}
    />
  );
}
