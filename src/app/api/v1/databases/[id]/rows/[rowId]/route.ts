import { apiDeleteDatabaseRow, apiUpdateDatabaseRow } from "@/lib/api/dept-ops";
import { notFound, ok, readJson, withApiAuth } from "@/lib/api/http";

type Params = { id: string; rowId: string };

/** Merges into the row's cell values — omitted fields keep their value. */
export const PATCH = withApiAuth<Params>(async (req, auth, { id, rowId }) => {
  const values = await readJson<Record<string, unknown>>(req);
  const updated = await apiUpdateDatabaseRow(auth.workspaceId, id, rowId, values);
  return updated ? ok({ data: { id: rowId }, updated: true }) : notFound("Row");
});

export const DELETE = withApiAuth<Params>(async (_req, auth, { id, rowId }) => {
  const deleted = await apiDeleteDatabaseRow(auth.workspaceId, id, rowId);
  return deleted ? ok({ data: { id: rowId }, deleted: true }) : notFound("Row");
});
