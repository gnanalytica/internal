import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreateMetric } from "@/lib/api/dept-ops";
import { getMetrics } from "@/lib/data";

export const GET = withApiAuth(async (req, auth) => {
  const project = new URL(req.url).searchParams.get("project") ?? undefined;
  const rows = await getMetrics(auth.workspaceId, project);
  return ok({
    data: rows.map((m) => ({
      id: m.id,
      name: m.name,
      unit: m.unit,
      cadence: m.cadence,
      isNorthStar: m.isNorthStar,
      projectId: m.projectId,
      latest: m.latest ?? null,
      previous: m.previous ?? null,
    })),
    count: rows.length,
  });
});

export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<Parameters<typeof apiCreateMetric>[1]>(req);
  const id = await apiCreateMetric(auth.workspaceId, body);
  return ok({ data: { id } }, 201);
});
