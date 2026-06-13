import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreateComment } from "@/lib/api/ops";

type Params = { id: string };

export const POST = withApiAuth<Params>(async (req, auth, { id }) => {
  const body = await readJson<{ body?: string }>(req);
  const commentId = await apiCreateComment(
    auth.workspaceId,
    auth.userId,
    id,
    body.body ?? "",
  );
  return ok({ data: { id: commentId } }, 201);
});
