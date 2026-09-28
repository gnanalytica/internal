import { apiResolvePageComment } from "@/lib/api/collab-ops";
import { notFound, ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiDeletePageComment, apiEditPageComment } from "@/lib/api/page-ops";
import { assertRecordAccess } from "@/lib/api/scope";

type Params = { id: string };

/** Edit your own comment's body, and/or resolve/reopen the thread with `resolved`. */
export const PATCH = withApiAuth<Params>(async (req, auth, { id }) => {
  await assertRecordAccess(auth, "page-comments", id);
  const patch = await readJson<{ body?: string; resolved?: boolean }>(req);
  let touched = false;
  if (typeof patch.resolved === "boolean") {
    touched = await apiResolvePageComment(auth.workspaceId, id, patch.resolved);
  }
  if (typeof patch.body === "string") {
    touched = (await apiEditPageComment(auth, id, patch.body)) || touched;
  }
  if (!touched) return notFound("Comment");
  return ok({ data: { id }, updated: true });
});

/** Delete your own comment; deleting a thread's first comment deletes its replies too. */
export const DELETE = withApiAuth<Params>(async (_req, auth, { id }) => {
  await assertRecordAccess(auth, "page-comments", id);
  const deleted = await apiDeletePageComment(auth, id);
  return deleted ? ok({ data: { id }, deleted: true }) : notFound("Comment");
});
