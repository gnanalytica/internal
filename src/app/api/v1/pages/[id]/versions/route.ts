import { apiListPageVersions, apiRestorePageVersion } from "@/lib/api/collab-ops";
import { apiError, notFound, ok, readJson, withApiAuth } from "@/lib/api/http";

type Params = { id: string };

export const GET = withApiAuth<Params>(async (_req, auth, { id }) => {
  const data = await apiListPageVersions(auth.workspaceId, id);
  return ok({ data, count: data.length });
});

/** Roll the page back to a snapshot. The pre-restore state is saved first. */
export const POST = withApiAuth<Params>(async (req, auth, { id }) => {
  const { versionId } = await readJson<{ versionId?: string }>(req);
  if (!versionId) return apiError("`versionId` is required.", 400);
  const restored = await apiRestorePageVersion(auth.workspaceId, id, versionId);
  if (!restored) return notFound("Version");
  return ok({ data: { pageId: id, versionId }, restored: true });
});
