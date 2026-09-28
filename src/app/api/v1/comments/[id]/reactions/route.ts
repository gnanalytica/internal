import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiToggleCommentReaction } from "@/lib/api/issue-extras";
import { assertCommentVisible } from "@/lib/api/scope";

type Params = { id: string };

/** Toggle the caller's reaction on an issue comment. */
export const POST = withApiAuth<Params>(async (req, auth, { id }) => {
  await assertCommentVisible(auth, id);
  const { emoji } = await readJson<{ emoji?: unknown }>(req);
  const on = await apiToggleCommentReaction(auth, id, emoji);
  return ok({ data: { on } });
});
