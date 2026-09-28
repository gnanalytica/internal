import { ok, withAdminApiAuth } from "@/lib/api/http";
import { apiIntegrations } from "@/lib/api/settings-ops";

/**
 * Whether GitHub and Slack are connected, and the GitHub repo's name. Tokens
 * and webhook URLs are never returned; connecting happens on the web. Admins only.
 */
export const GET = withAdminApiAuth(async (_req, auth) => {
  return ok({ data: await apiIntegrations(auth.workspaceId) });
});
