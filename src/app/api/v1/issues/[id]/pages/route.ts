import { apiLinkIssuePage, apiUnlinkIssuePage } from "@/lib/api/collab-ops";
import { apiError, notFound, ok, readJson, withApiAuth } from "@/lib/api/http";

type Params = { id: string };

export const POST = withApiAuth<Params>(async (req, auth, { id }) => {
  const { pageId } = await readJson<{ pageId?: string }>(req);
  if (!pageId) return apiError("`pageId` is required.", 400);
  await apiLinkIssuePage(auth.workspaceId, id, pageId);
  return ok({ data: { issueId: id, pageId }, linked: true }, 201);
});

export const DELETE = withApiAuth<Params>(async (req, auth, { id }) => {
  const pageId = new URL(req.url).searchParams.get("pageId");
  if (!pageId) return apiError("`?pageId=` is required.", 400);
  const removed = await apiUnlinkIssuePage(auth.workspaceId, id, pageId);
  if (!removed) return notFound("Link");
  return ok({ data: { issueId: id, pageId }, unlinked: true });
});
