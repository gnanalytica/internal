import { apiCreateCustomerRequest } from "@/lib/api/customer-ops";
import { ok, readJson, withApiAuth } from "@/lib/api/http";

type Params = { id: string; kind: string; cid: string };

/**
 * Add a request from this customer, waiting on us:
 * `{ "subject": "…", "body": "…", "via": "whatsapp" | "call" | "email" | "visit" }`
 * (`body` optional, `via` defaults to whatsapp). It becomes a ticket on the
 * project tied to the customer's deal, assigned to the caller. Reply, change
 * state or convert it through `/tickets/{id}`.
 */
export const POST = withApiAuth<Params>(async (req, auth, { id, kind, cid }) =>
  ok({ data: await apiCreateCustomerRequest(auth, id, kind, cid, await readJson(req)) }, 201),
);
