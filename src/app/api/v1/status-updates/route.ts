import { apiError, ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreateStatusUpdate } from "@/lib/api/dept-ops";
import { getStatusUpdates } from "@/lib/data";
import { assertProjectVisible } from "@/lib/api/scope";

export const GET = withApiAuth(async (req, auth) => {
  const project = new URL(req.url).searchParams.get("project");
  if (!project) return apiError("`?project=<id>` is required.", 400);
  assertProjectVisible(auth, project, "Project");
  const rows = await getStatusUpdates(auth.workspaceId, project);
  return ok({ data: rows, count: rows.length });
});

export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<Parameters<typeof apiCreateStatusUpdate>[2]>(req);
  assertProjectVisible(auth, (body as { projectId?: string | null }).projectId, "Project");
  const id = await apiCreateStatusUpdate(auth.workspaceId, auth.userId, body);
  return ok({ data: { id } }, 201);
});
