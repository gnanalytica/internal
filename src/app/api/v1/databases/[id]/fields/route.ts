import { apiAddField } from "@/lib/api/database-ops";
import { ok, readJson, withApiAuth } from "@/lib/api/http";

type Params = { id: string };

/**
 * type: text|number|select|multiSelect|checkbox|date|url|email|relation|rollup.
 * select/multiSelect take `options` ([{ label, color }]); relation needs
 * `relationDatabaseId`; rollup needs `config` { relationFieldId, fn:
 * count|sum|avg|min|max, targetFieldId (a number field, unless count) }.
 */
export const POST = withApiAuth<Params>(async (req, auth, { id }) => {
  const body = await readJson<Record<string, unknown>>(req);
  const fieldId = await apiAddField(auth.workspaceId, id, body);
  return ok({ data: { id: fieldId, databaseId: id } }, 201);
});
