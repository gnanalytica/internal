import { apiError, ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreateStatusUpdate } from "@/lib/api/dept-ops";
import { getStatusUpdates } from "@/lib/data";

export const GET = withApiAuth(async (req, auth) => {
  const project = new URL(req.url).searchParams.get("project");
  if (!project) return apiError("`?project=<id>` is required.", 400);
  const rows = await getStatusUpdates(auth.workspaceId, project);
  return ok({ data: rows, count: rows.length });
});

export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<Parameters<typeof apiCreateStatusUpdate>[2]>(req);
  const id = await apiCreateStatusUpdate(auth.workspaceId, auth.userId, body);
  return ok({ data: { id } }, 201);
});
