import { apiUpdateField } from "@/lib/api/database-ops";
import { apiDeleteDatabaseField } from "@/lib/api/dept-ops";
import { notFound, ok, readJson, withApiAuth } from "@/lib/api/http";

type Params = { id: string; fieldId: string };

/**
 * Rename (`name`), retype (`type`, plus `relationDatabaseId` / `config` where
 * the new type needs them) or replace a select's `options`. Give a renamed
 * option its old label as `previousLabel` and rows keep their choice.
 */
export const PATCH = withApiAuth<Params>(async (req, auth, { id, fieldId }) => {
  const patch = await readJson<Record<string, unknown>>(req);
  const updated = await apiUpdateField(auth.workspaceId, id, fieldId, patch);
  return updated ? ok({ data: { id: fieldId }, updated: true }) : notFound("Field");
});

export const DELETE = withApiAuth<Params>(async (_req, auth, { id, fieldId }) => {
  const deleted = await apiDeleteDatabaseField(auth.workspaceId, id, fieldId);
  return deleted ? ok({ data: { id: fieldId }, deleted: true }) : notFound("Field");
});
