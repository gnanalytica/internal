import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiSetSubscription } from "@/lib/api/issue-extras";

/** Follow or unfollow: `{ type: "issue" | "page" | "project", id, on }` — idempotent. */
export const POST = withApiAuth(async (req, auth) => {
  const on = await apiSetSubscription(auth, await readJson(req));
  return ok({ data: { watching: on } });
});
