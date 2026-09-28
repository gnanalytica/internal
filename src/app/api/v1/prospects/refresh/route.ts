import { ok, withApiAuth } from "@/lib/api/http";
import { invalidateProspects } from "@/lib/api/prospects";

/** Re-read the sheet on the next request instead of waiting for the one-minute cache. */
export const POST = withApiAuth(async () => {
  invalidateProspects();
  return ok({ refreshed: true });
});
