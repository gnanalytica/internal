import { apiDuplicateRow } from "@/lib/api/database-ops";
import { notFound, ok, withApiAuth } from "@/lib/api/http";

type Params = { id: string; rowId: string };

/** Copy the row's cells into a new row at the end of the database. */
export const POST = withApiAuth<Params>(async (_req, auth, { id, rowId }) => {
  const newId = await apiDuplicateRow(auth.workspaceId, id, rowId);
  if (!newId) return notFound("Row");
  return ok({ data: { id: newId, databaseId: id, duplicateOf: rowId } }, 201);
});
