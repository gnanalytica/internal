import { apiDeleteIssueRelation } from "@/lib/api/collab-ops";
import { notFound, ok, withApiAuth } from "@/lib/api/http";
import { assertRelationVisible } from "@/lib/api/scope";

type Params = { id: string };

export const DELETE = withApiAuth<Params>(async (_req, auth, { id }) => {
  await assertRelationVisible(auth, id);
  const deleted = await apiDeleteIssueRelation(auth.workspaceId, id);
  return deleted ? ok({ data: { id }, deleted: true }) : notFound("Relation");
});
