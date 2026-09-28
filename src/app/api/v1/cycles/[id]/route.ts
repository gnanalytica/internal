import { ok, withApiAuth } from "@/lib/api/http";
import { apiCycleDetail } from "@/lib/api/planning-ops";
import { recordRoute } from "@/lib/api/record-route";

type Params = { id: string };

const handlers = recordRoute("cycles");

/** The cycle's dates, progress and burndown. Its tasks: GET /issues?cycle=<id>. */
export const GET = withApiAuth<Params>(async (_req, auth, { id }) => ok({ data: await apiCycleDetail(auth, id) }));

export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
