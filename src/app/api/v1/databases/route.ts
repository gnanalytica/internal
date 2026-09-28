import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreateStarterDatabase, apiListDatabasesSummary } from "@/lib/api/database-ops";
import { apiCreateDatabase } from "@/lib/api/dept-ops";

/** Every database in the workspace, by name, with how many fields and rows each has. */
export const GET = withApiAuth(async (_req, auth) => {
  const rows = await apiListDatabasesSummary(auth.workspaceId);
  return ok({ data: rows, count: rows.length });
});

/**
 * Create a database. With `template: "starter"` it gets the web's starter
 * schema (Name and Status fields, three empty rows); otherwise it starts empty.
 */
export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<{ name?: string; icon?: string; template?: string }>(req);
  const id = body.template === "starter" ? await apiCreateStarterDatabase(auth.workspaceId, body) : await apiCreateDatabase(auth.workspaceId, body);
  return ok({ data: { id } }, 201);
});
