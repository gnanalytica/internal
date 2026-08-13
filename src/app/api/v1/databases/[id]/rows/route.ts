import { apiAddDatabaseRow } from "@/lib/api/dept-ops";
import { ok, readJson, withApiAuth } from "@/lib/api/http";

type Params = { id: string };

/** Body is the row's cell values, keyed by field id. */
export const POST = withApiAuth<Params>(async (req, auth, { id }) => {
  const values = await readJson<Record<string, unknown>>(req);
  const rowId = await apiAddDatabaseRow(auth.workspaceId, id, values);
  return ok({ data: { id: rowId, databaseId: id } }, 201);
});
