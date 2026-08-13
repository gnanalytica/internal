import { apiResolvePageComment } from "@/lib/api/collab-ops";
import { apiDeleteRecord, apiUpdateRecord } from "@/lib/api/records";
import { notFound, ok, readJson, withApiAuth } from "@/lib/api/http";

type Params = { id: string };

/** Edit the body, and/or resolve/reopen the thread with `resolved`. */
export const PATCH = withApiAuth<Params>(async (req, auth, { id }) => {
  const patch = await readJson<{ body?: string; resolved?: boolean }>(req);
  let touched = false;
  if (typeof patch.resolved === "boolean") {
    touched = await apiResolvePageComment(auth.workspaceId, id, patch.resolved);
  }
  if (typeof patch.body === "string") {
    const edited = await apiUpdateRecord("page-comments", auth.workspaceId, id, {
      body: patch.body,
    });
    touched = edited || touched;
  }
  if (!touched) return notFound("Comment");
  return ok({ data: { id }, updated: true });
});

export const DELETE = withApiAuth<Params>(async (_req, auth, { id }) => {
  const deleted = await apiDeleteRecord("page-comments", auth.workspaceId, id);
  return deleted ? ok({ data: { id }, deleted: true }) : notFound("Comment");
});
