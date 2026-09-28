import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiAddPageComment, apiPageCommentList } from "@/lib/api/page-ops";
import { assertPageVisible } from "@/lib/api/scope";

type Params = { id: string };

/** Every comment, oldest first. A reply's `parentId` is its thread; each carries its reactions. */
export const GET = withApiAuth<Params>(async (_req, auth, { id }) => {
  await assertPageVisible(auth, id);
  const data = await apiPageCommentList(auth, id);
  return ok({ data, count: data.length });
});

/** `parentId` makes it a reply; `blockId` anchors it to a block. Notifies like the web. */
export const POST = withApiAuth<Params>(async (req, auth, { id }) => {
  await assertPageVisible(auth, id);
  const body = await readJson<{ body?: unknown; parentId?: unknown; blockId?: unknown }>(req);
  const commentId = await apiAddPageComment(auth, id, body);
  return ok({ data: { id: commentId, pageId: id } }, 201);
});
