import { ok, withApiAuth } from "@/lib/api/http";
import { apiProjectSummaries } from "@/lib/api/planning-ops";

/**
 * Every project and operation the caller may see, with health, current
 * milestone, progress, per-department counts and the running cycle — the
 * web's projects list, timeline and "this week" in one read.
 */
export const GET = withApiAuth(async (_req, auth) => {
  const data = await apiProjectSummaries(auth);
  return ok({ data, count: data.length });
});
