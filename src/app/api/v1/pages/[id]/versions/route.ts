import { apiError, notFound, ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiPageVersions, apiRestoreVersion } from "@/lib/api/page-ops";
import { assertPageVisible } from "@/lib/api/scope";

type Params = { id: string };

/** Snapshots, newest first, with who caused each and why (auto, restore, conflict). */
export const GET = withApiAuth<Params>(async (_req, auth, { id }) => {
  await assertPageVisible(auth, id);
  const data = await apiPageVersions(auth.workspaceId, id);
  return ok({ data, count: data.length });
});

/** Roll the page back to a snapshot. The pre-restore state is saved first. */
export const POST = withApiAuth<Params>(async (req, auth, { id }) => {
  await assertPageVisible(auth, id);
  const { versionId } = await readJson<{ versionId?: string }>(req);
  if (!versionId) return apiError("`versionId` is required.", 400);
  const restored = await apiRestoreVersion(auth, id, versionId);
  if (!restored) return notFound("Version");
  return ok({ data: { pageId: id, versionId }, restored: true });
});
