import { ok, withApiAuth } from "@/lib/api/http";
import { apiSearch } from "@/lib/api/ops";
import {  } from "@/lib/api/scope";

export const GET = withApiAuth(async (req, auth) => {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const hits = await apiSearch(auth.workspaceId, q, auth.scope);
  return ok({ data: hits, count: hits.length });
});
