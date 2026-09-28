import { apiListTrashedPages } from "@/lib/api/collab-ops";
import { ok, withApiAuth } from "@/lib/api/http";
import { visibleRows } from "@/lib/api/scope";

export const GET = withApiAuth(async (_req, auth) => {
  const data = visibleRows(auth, await apiListTrashedPages(auth.workspaceId), (p) => p.projectId);
  return ok({ data, count: data.length });
});
