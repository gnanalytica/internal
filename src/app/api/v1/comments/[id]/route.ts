import { apiDeleteIssueComment } from "@/lib/api/collab-ops";
import { notFound, ok, withApiAuth } from "@/lib/api/http";
import { assertCommentVisible } from "@/lib/api/scope";

type Params = { id: string };

export const DELETE = withApiAuth<Params>(async (_req, auth, { id }) => {
  await assertCommentVisible(auth, id);
  const deleted = await apiDeleteIssueComment(auth.workspaceId, id);
  return deleted ? ok({ data: { id }, deleted: true }) : notFound("Comment");
});
