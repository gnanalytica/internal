import { notFound, ok, readJson, withAdminApiAuth, withApiAuth } from "@/lib/api/http";
import {
  apiDeleteRecord,
  apiUpdateRecord,
  writableFields,
  type ResourceName,
} from "@/lib/api/records";

type Params = { id: string };

/**
 * Build the `PATCH` / `DELETE` handlers for a workspace-scoped record type.
 * Route files stay a two-line binding so adding a resource means adding a row
 * to the registry in `records.ts`, not another copy of this logic.
 */
export function recordRoute(name: ResourceName, adminOnly: ("PATCH" | "DELETE")[] = []) {
  const wrap = (m: "PATCH" | "DELETE") => (adminOnly.includes(m) ? withAdminApiAuth : withApiAuth);
  const PATCH = wrap("PATCH")<Params>(async (req, auth, { id }) => {
    const patch = await readJson<Record<string, unknown>>(req);
    const updated = await apiUpdateRecord(name, auth.workspaceId, id, patch);
    if (!updated) return notFound(name);
    return ok({ data: { id }, updated: true, writable: writableFields(name) });
  });

  const DELETE = wrap("DELETE")<Params>(async (_req, auth, { id }) => {
    const deleted = await apiDeleteRecord(name, auth.workspaceId, id);
    if (!deleted) return notFound(name);
    return ok({ data: { id }, deleted: true });
  });

  return { PATCH, DELETE };
}
