import { featureDto } from "@/lib/api/dto";
import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreateFeature } from "@/lib/api/ops";
import { getFeatures } from "@/lib/data";
import { assertProjectVisible, visibleRows } from "@/lib/api/scope";

export const GET = withApiAuth(async (req, auth) => {
  const project = new URL(req.url).searchParams.get("project") ?? undefined;
  const rows = visibleRows(auth, await getFeatures(auth.workspaceId, project), (r) => r.projectId);
  return ok({ data: rows.map(featureDto), count: rows.length });
});

export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<Parameters<typeof apiCreateFeature>[1]>(req);
  assertProjectVisible(auth, (body as { projectId?: string | null }).projectId, "Project");
  const id = await apiCreateFeature(auth.workspaceId, body);
  const row = (await getFeatures(auth.workspaceId)).find((f) => f.id === id);
  return ok({ data: row ? featureDto(row) : { id } }, 201);
});
