import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiListFavorites, apiSetFavorite } from "@/lib/api/issue-extras";

/** The caller's favourites (issues, pages, projects), oldest first. */
export const GET = withApiAuth(async (_req, auth) => {
  const data = await apiListFavorites(auth);
  return ok({ data, count: data.length });
});

/** `{ type: "issue" | "page" | "project", id, on }` — idempotent. */
export const POST = withApiAuth(async (req, auth) => {
  const on = await apiSetFavorite(auth, await readJson(req));
  return ok({ data: { favorite: on } });
});
