import { apiSetOnboardingStep } from "@/lib/api/customer-ops";
import { ok, readJson, withApiAuth } from "@/lib/api/http";

type Params = { id: string; kind: string; cid: string };

/**
 * Tick or untick one onboarding step: `{ "step": "kickoff", "done": true }`.
 * Steps: kickoff, setup, first-report, accepted, check-ins, asked-to-pay.
 * Answers with the customer's ticks as saved (`{ step: "yyyy-mm-dd" }`).
 * Opens the customer's deal first if they don't have one yet, as the web does.
 */
export const POST = withApiAuth<Params>(async (req, auth, { id, kind, cid }) =>
  ok({ data: { onboarding: await apiSetOnboardingStep(auth, id, kind, cid, await readJson(req)) } }),
);
