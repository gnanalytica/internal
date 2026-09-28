import { ok, withApiAuth } from "@/lib/api/http";
import { searchForApi } from "@/lib/api/search";

/**
 * `?q=` across issues, docs, projects, databases, cycles, milestones,
 * features, tickets, deals, accounts and contacts. Each hit carries its
 * `projectId` (when it has one) and a web `url`. Hidden projects and, for
 * members, deals never appear.
 */
export const GET = withApiAuth(async (req, auth) => {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const hits = await searchForApi(auth.workspaceId, q.slice(0, 200), auth.scope);
  return ok({ data: hits, count: hits.length });
});
