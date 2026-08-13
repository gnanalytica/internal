import {
  apiAddIssueRelation,
  apiListIssueRelations,
} from "@/lib/api/collab-ops";
import { ok, readJson, withApiAuth } from "@/lib/api/http";

type Params = { id: string };

export const GET = withApiAuth<Params>(async (_req, auth, { id }) => {
  const data = await apiListIssueRelations(auth.workspaceId, id);
  return ok({ data, count: data.length });
});

/** type: blocks | blocked_by | related | duplicate */
export const POST = withApiAuth<Params>(async (req, auth, { id }) => {
  const body = await readJson<{ relatedIssueId?: string; type?: string }>(req);
  const relationId = await apiAddIssueRelation(auth.workspaceId, id, body);
  return ok({ data: { id: relationId } }, 201);
});
