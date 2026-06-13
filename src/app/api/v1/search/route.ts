import { ok, withApiAuth } from "@/lib/api/http";
import { apiSearch } from "@/lib/api/ops";

export const GET = withApiAuth(async (req, auth) => {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const hits = await apiSearch(auth.workspaceId, q);
  return ok({ data: hits, count: hits.length });
});
