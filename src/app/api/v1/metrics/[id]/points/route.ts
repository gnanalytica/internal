import { apiAddMetricPoint, apiListMetricPoints } from "@/lib/api/dept-ops";
import { ok, readJson, withApiAuth } from "@/lib/api/http";

type Params = { id: string };

export const GET = withApiAuth<Params>(async (_req, auth, { id }) => {
  const data = await apiListMetricPoints(auth.workspaceId, id);
  return ok({ data, count: data.length });
});

export const POST = withApiAuth<Params>(async (req, auth, { id }) => {
  const body = await readJson<{ periodDate?: string; value?: number }>(req);
  const pointId = await apiAddMetricPoint(auth.workspaceId, id, body);
  return ok({ data: { id: pointId, metricId: id } }, 201);
});
