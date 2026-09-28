import { apiError, ok, withApiAuth } from "@/lib/api/http";
import { apiSignInMethods } from "@/lib/api/settings-ops";

/**
 * The ways the key's person can sign in (Google, GitHub, email & password),
 * each marked connected or not. Read-only: they are linked and unlinked on
 * the web, where the browser session that proves it's them lives.
 */
export const GET = withApiAuth(async (_req, auth) => {
  if (!auth.userId) return apiError("This key isn't tied to a person.", 400);
  const methods = await apiSignInMethods(auth.userId);
  return ok({ data: methods ?? [], available: methods !== null });
});
