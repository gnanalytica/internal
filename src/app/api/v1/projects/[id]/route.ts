import { apiError, ok, readJson, withApiAuth } from "@/lib/api/http";
import { adminOnlyFieldsIn } from "@/lib/api/planning";
import { apiProjectDetail } from "@/lib/api/planning-ops";
import { recordRoute } from "@/lib/api/record-route";

type Params = { id: string };

const handlers = recordRoute("projects", ["DELETE"]);

/** The full project: departments this caller may open, health, milestone, cycle, progress. */
export const GET = withApiAuth<Params>(async (_req, auth, { id }) => ok({ data: await apiProjectDetail(auth, id) }));

/**
 * The generic whitelisted patch, except that a member may not reassign the
 * owner or strategist: the web offers that picker to admins only, and the
 * owner is who sees the project's Finance.
 */
export const PATCH = withApiAuth<Params>(async (req, auth, params) => {
  if (auth.scope.restricted) {
    const blocked = adminOnlyFieldsIn(await readJson<Record<string, unknown>>(req.clone()));
    if (blocked.length > 0) return apiError(`Only workspace admins can change ${blocked.join(" or ")}.`, 403);
  }
  return handlers.PATCH(req, { params: Promise.resolve(params) });
});

export const DELETE = handlers.DELETE;
