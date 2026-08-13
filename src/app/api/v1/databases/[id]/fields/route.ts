import { apiAddDatabaseField } from "@/lib/api/dept-ops";
import { ok, readJson, withApiAuth } from "@/lib/api/http";

type Params = { id: string };

/** type: text|number|select|checkbox|date|relation|rollup */
export const POST = withApiAuth<Params>(async (req, auth, { id }) => {
  const body = await readJson<Parameters<typeof apiAddDatabaseField>[2]>(req);
  const fieldId = await apiAddDatabaseField(auth.workspaceId, id, body);
  return ok({ data: { id: fieldId, databaseId: id } }, 201);
});
