import { notFound, ok, withAdminApiAuth } from "@/lib/api/http";
import { apiRevokeApiKey } from "@/lib/api/settings-ops";

/** Revoke a key (or sign a phone out). Anything using it stops working at once. Admins only. */
export const DELETE = withAdminApiAuth<{ id: string }>(async (_req, auth, { id }) => {
  const revoked = await apiRevokeApiKey(auth.workspaceId, id);
  if (!revoked) return notFound("API key");
  return ok({ data: { id }, revoked: true });
});
