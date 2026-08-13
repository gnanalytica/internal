import { apiPurgePage, apiRestorePage } from "@/lib/api/collab-ops";
import { notFound, ok, withApiAuth } from "@/lib/api/http";

type Params = { id: string };

/** Restore a trashed page (and anything trashed along with it). */
export const POST = withApiAuth<Params>(async (_req, auth, { id }) => {
  const restored = await apiRestorePage(auth.workspaceId, id);
  if (!restored) return notFound("Trashed page");
  return ok({ data: { id }, restored: true });
});

/** Permanently delete a page that is already in the trash. */
export const DELETE = withApiAuth<Params>(async (_req, auth, { id }) => {
  const purged = await apiPurgePage(auth.workspaceId, id);
  if (!purged) return notFound("Trashed page");
  return ok({ data: { id }, purged: true });
});
