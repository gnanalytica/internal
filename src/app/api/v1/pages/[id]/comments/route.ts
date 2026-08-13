import { apiCreatePageComment, apiListPageComments } from "@/lib/api/collab-ops";
import { ok, readJson, withApiAuth } from "@/lib/api/http";

type Params = { id: string };

export const GET = withApiAuth<Params>(async (_req, auth, { id }) => {
  const data = await apiListPageComments(auth.workspaceId, id);
  return ok({ data, count: data.length });
});

/** `parentId` makes it a reply; `blockId` anchors it to a block. */
export const POST = withApiAuth<Params>(async (req, auth, { id }) => {
  const body = await readJson<Parameters<typeof apiCreatePageComment>[3]>(req);
  const commentId = await apiCreatePageComment(auth.workspaceId, auth.userId, id, body);
  return ok({ data: { id: commentId, pageId: id } }, 201);
});
