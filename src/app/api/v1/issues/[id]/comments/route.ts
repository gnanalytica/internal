import { apiCreateComment } from "@/lib/api/ops";
import { apiListIssueComments } from "@/lib/api/collab-ops";
import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { assertIssueVisible } from "@/lib/api/scope";

type Params = { id: string };

export const GET = withApiAuth<Params>(async (_req, auth, { id }) => {
  await assertIssueVisible(auth, id);
  const data = await apiListIssueComments(auth.workspaceId, id);
  return ok({ data, count: data.length });
});

export const POST = withApiAuth<Params>(async (req, auth, { id }) => {
  await assertIssueVisible(auth, id);
  const { body } = await readJson<{ body?: string }>(req);
  const commentId = await apiCreateComment(auth.workspaceId, auth.userId, id, body ?? "");
  return ok({ data: { id: commentId, issueId: id } }, 201);
});
