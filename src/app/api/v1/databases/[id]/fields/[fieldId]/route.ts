import { apiDeleteDatabaseField } from "@/lib/api/dept-ops";
import { notFound, ok, withApiAuth } from "@/lib/api/http";

type Params = { id: string; fieldId: string };

export const DELETE = withApiAuth<Params>(async (_req, auth, { id, fieldId }) => {
  const deleted = await apiDeleteDatabaseField(auth.workspaceId, id, fieldId);
  return deleted ? ok({ data: { id: fieldId }, deleted: true }) : notFound("Field");
});
