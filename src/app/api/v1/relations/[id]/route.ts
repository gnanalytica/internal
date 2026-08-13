import { apiDeleteIssueRelation } from "@/lib/api/collab-ops";
import { notFound, ok, withApiAuth } from "@/lib/api/http";

type Params = { id: string };

export const DELETE = withApiAuth<Params>(async (_req, auth, { id }) => {
  const deleted = await apiDeleteIssueRelation(auth.workspaceId, id);
  return deleted ? ok({ data: { id }, deleted: true }) : notFound("Relation");
});
