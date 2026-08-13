import { apiListTrashedPages } from "@/lib/api/collab-ops";
import { ok, withApiAuth } from "@/lib/api/http";

export const GET = withApiAuth(async (_req, auth) => {
  const data = await apiListTrashedPages(auth.workspaceId);
  return ok({ data, count: data.length });
});
