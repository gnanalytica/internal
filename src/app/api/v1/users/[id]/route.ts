import { apiRemoveMember, apiUpdateMember } from "@/lib/api/dept-ops";
import { notFound, ok, readJson, withApiAuth } from "@/lib/api/http";

type Params = { id: string };

/** Writable: role, title, entity, employment, startDate, managerId. */
export const PATCH = withApiAuth<Params>(async (req, auth, { id }) => {
  const patch = await readJson<Parameters<typeof apiUpdateMember>[2]>(req);
  const updated = await apiUpdateMember(auth.workspaceId, id, patch);
  if (!updated) return notFound("Member");
  return ok({ data: { id }, updated: true });
});

export const DELETE = withApiAuth<Params>(async (_req, auth, { id }) => {
  const removed = await apiRemoveMember(auth.workspaceId, id);
  if (!removed) return notFound("Member");
  return ok({ data: { id }, removed: true });
});
