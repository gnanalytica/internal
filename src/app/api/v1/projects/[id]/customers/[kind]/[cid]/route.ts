import { apiGetCustomer } from "@/lib/api/customer-ops";
import { ok, withApiAuth } from "@/lib/api/http";

type Params = { id: string; kind: string; cid: string };

/**
 * One customer of a project (Valytica's Sales → Customers): a prospect at
 * Pilot running or Won, by its prospect kind and ID (percent-encode IDs with
 * slashes). Carries its health, onboarding steps (ticked by hand, or the
 * check-ins step by itself), requests, check-ins since they became a
 * customer, plan, owner and last touch — what the web's customer record shows.
 *
 * Follows the Sales rule: a caller who may not open Sales gets 403.
 */
export const GET = withApiAuth<Params>(async (_req, auth, { id, kind, cid }) => ok({ data: await apiGetCustomer(auth, id, kind, cid) }));
