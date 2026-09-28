import { notFound, ok, readJson, withAdminApiAuth } from "@/lib/api/http";
import { apiDeleteOrgRole, apiUpdateOrgRole } from "@/lib/api/org-ops";

type Params = { id: string };

/** Writable: title, userId (a member, or null for an open seat), parentId (null for the top). Admins only. */
export const PATCH = withAdminApiAuth<Params>(async (req, auth, { id }) => {
  const patch = await readJson<{ title?: unknown; userId?: unknown; parentId?: unknown }>(req);
  const updated = await apiUpdateOrgRole(auth.workspaceId, id, patch);
  if (!updated) return notFound("Role");
  return ok({ data: { id }, updated: true });
});

/** Remove a role; its direct reports move up to its parent. Admins only. */
export const DELETE = withAdminApiAuth<Params>(async (_req, auth, { id }) => {
  const deleted = await apiDeleteOrgRole(auth.workspaceId, id);
  if (!deleted) return notFound("Role");
  return ok({ data: { id }, deleted: true });
});
