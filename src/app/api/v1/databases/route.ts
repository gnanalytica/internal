import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreateDatabase } from "@/lib/api/dept-ops";
import { getDatabases } from "@/lib/data";

export const GET = withApiAuth(async (_req, auth) => {
  const rows = await getDatabases(auth.workspaceId);
  return ok({
    data: rows.map((d) => ({ id: d.id, name: d.name, icon: d.icon })),
    count: rows.length,
  });
});

export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<Parameters<typeof apiCreateDatabase>[1]>(req);
  const id = await apiCreateDatabase(auth.workspaceId, body);
  return ok({ data: { id } }, 201);
});
