import { notFound, ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiTogglePageCommentReaction } from "@/lib/api/page-ops";
import { assertRecordAccess } from "@/lib/api/scope";

type Params = { id: string };

/** Toggle the caller's `emoji` reaction (one of 👍 ❤️ 🎉 😄 🚀 👀 ✅). */
export const POST = withApiAuth<Params>(async (req, auth, { id }) => {
  await assertRecordAccess(auth, "page-comments", id);
  const { emoji } = await readJson<{ emoji?: unknown }>(req);
  const result = await apiTogglePageCommentReaction(auth, id, emoji);
  if (!result) return notFound("Comment");
  return ok({ data: { id, emoji, on: result.on } });
});
