import { ok, withApiAuth } from "@/lib/api/http";
import { portfolioForScope } from "@/lib/api/overview-rules";
import { getPortfolio } from "@/lib/data";

/**
 * The web Overview: every project and operation with its owner, latest health
 * (from status updates), current milestone and issue progress. Confidential
 * projects are left out for members, as on the web.
 */
export const GET = withApiAuth(async (_req, auth) => {
  const rows = portfolioForScope(await getPortfolio(auth.workspaceId), auth.scope);
  return ok({ data: rows, count: rows.length });
});
