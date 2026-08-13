import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreateOrgRole } from "@/lib/api/dept-ops";
import { getOrgRoles } from "@/lib/data";

export const GET = withApiAuth(async (_req, auth) => {
  const roots = await getOrgRoles(auth.workspaceId);
  return ok({ data: roots, count: roots.length });
});

export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<Parameters<typeof apiCreateOrgRole>[1]>(req);
  const id = await apiCreateOrgRole(auth.workspaceId, body);
  return ok({ data: { id } }, 201);
});
