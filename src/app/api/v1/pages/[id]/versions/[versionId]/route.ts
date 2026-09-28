import { notFound, ok, withApiAuth } from "@/lib/api/http";
import { apiPageVersion } from "@/lib/api/page-ops";
import { assertPageVisible } from "@/lib/api/scope";

type Params = { id: string; versionId: string };

/** One snapshot's title and body as Markdown, for a read-only preview. */
export const GET = withApiAuth<Params>(async (_req, auth, { id, versionId }) => {
  await assertPageVisible(auth, id);
  const version = await apiPageVersion(auth.workspaceId, id, versionId);
  if (!version) return notFound("Version");
  return ok({ data: version });
});
