import { ok, withAdminApiAuth } from "@/lib/api/http";
import { getMembersWithRole } from "@/lib/data";

/**
 * The People & HR directory: every member with the HR fields the web keeps in
 * the confidential People & HR operation (employment, start date, manager).
 * Admins only — members get names and titles from `GET /users`.
 */
export const GET = withAdminApiAuth(async (_req, auth) => {
  const members = await getMembersWithRole(auth.workspaceId);
  const nameOf = new Map(members.map((m) => [m.id, m.name]));
  const data = members.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role,
    title: m.title ?? null,
    entity: m.entity,
    employment: m.employment,
    startDate: m.startDate ? new Date(m.startDate).toISOString() : null,
    manager: m.managerId ? { id: m.managerId, name: nameOf.get(m.managerId) ?? null } : null,
  }));
  return ok({ data, count: data.length });
});
