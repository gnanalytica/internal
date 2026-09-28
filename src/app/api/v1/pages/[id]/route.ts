import { apiDeletePage } from "@/lib/api/ops";
import { notFound, ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiPageDetail, apiSavePage, type SavePageInput } from "@/lib/api/page-ops";
import { assertPageVisible } from "@/lib/api/scope";

type Params = { id: string };

/**
 * The page with its body as Markdown and editor JSON, where it sits (parent,
 * project), who made it, its visible linked issues and sub-pages, and whether
 * its body can be edited as Markdown without losing formatting.
 */
export const GET = withApiAuth<Params>(async (_req, auth, { id }) => {
  await assertPageVisible(auth, id);
  const page = await apiPageDetail(auth, id);
  if (!page) return notFound("Page");
  return ok({ data: page });
});

/**
 * Change the title, icon, or body. `content` (or `markdown`) is Markdown and
 * REPLACES the whole body; it is refused with 422 when the page has formatting
 * Markdown can't hold, unless `allowLossy: true`. Send `knownUpdatedAt` — the
 * `updatedAt` you loaded — to get a 409 instead of overwriting someone else's
 * later save.
 */
export const PATCH = withApiAuth<Params>(async (req, auth, { id }) => {
  await assertPageVisible(auth, id);
  const input = await readJson<SavePageInput>(req);
  const result = await apiSavePage(auth, id, input);
  if (!result.ok && result.reason === "not_found") return notFound("Page");
  if (!result.ok && result.reason === "conflict")
    return Response.json(
      {
        error: "Someone else saved this page after you opened it. Reload to see their changes, then make your edit again.",
        conflict: true,
        updatedAt: result.updatedAt,
      },
      { status: 409 },
    );
  const page = await apiPageDetail(auth, id);
  return ok({ data: page ?? { id } });
});

export const DELETE = withApiAuth<Params>(async (_req, auth, { id }) => {
  await assertPageVisible(auth, id);
  const deleted = await apiDeletePage(auth.workspaceId, id);
  if (!deleted) return notFound("Page");
  // Soft delete — the page and its children are recoverable from /trash.
  return ok({ data: { id }, deleted: true, recoverable: true });
});
