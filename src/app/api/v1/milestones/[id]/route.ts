import { ok, withApiAuth } from "@/lib/api/http";
import { apiMilestoneDetail } from "@/lib/api/planning-ops";
import { recordRoute } from "@/lib/api/record-route";

type Params = { id: string };

const handlers = recordRoute("milestones");

/** The milestone with its features and the tasks attached straight to it. */
export const GET = withApiAuth<Params>(async (_req, auth, { id }) => ok({ data: await apiMilestoneDetail(auth, id) }));

export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
