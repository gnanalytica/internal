import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreateMetric } from "@/lib/api/dept-ops";
import { ApiInputError } from "@/lib/api/errors";
import { apiUpdateRecord } from "@/lib/api/records";
import { getMetrics } from "@/lib/data";
import { assertProjectVisible, visibleRows } from "@/lib/api/scope";

export const GET = withApiAuth(async (req, auth) => {
  const project = new URL(req.url).searchParams.get("project") ?? undefined;
  const rows = visibleRows(auth, await getMetrics(auth.workspaceId, project), (r) => r.projectId);
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
      // What the metric steers towards, and which side of it is good.
      target: m.target ?? null,
      targetDirection: m.targetDirection,
      // The series, oldest first — enough for a sparkline without a second read.
      points: m.points.map((p) => ({ id: p.id, periodDate: p.periodDate, value: p.value })),
    })),
    count: rows.length,
  });
});

export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<Parameters<typeof apiCreateMetric>[1] & { target?: number | null; targetDirection?: string }>(req);
  assertProjectVisible(auth, (body as { projectId?: string | null }).projectId, "Project");
  if (!body.name?.trim()) throw new ApiInputError("`name` is required.");
  if (body.cadence && !["weekly", "monthly", "quarterly"].includes(body.cadence))
    throw new ApiInputError("`cadence` must be one of: weekly, monthly, quarterly.");
  if (body.target != null && !Number.isFinite(Number(body.target))) throw new ApiInputError("`target` must be a number.");
  if (body.targetDirection !== undefined && !["above", "below"].includes(body.targetDirection))
    throw new ApiInputError("`targetDirection` must be one of: above, below.");
  const id = await apiCreateMetric(auth.workspaceId, body);
  const targetPatch = Object.fromEntries(
    Object.entries({ target: body.target, targetDirection: body.targetDirection }).filter(([, v]) => v !== undefined),
  );
  if (Object.keys(targetPatch).length > 0) await apiUpdateRecord("metrics", auth.workspaceId, id, targetPatch);
  return ok({ data: { id } }, 201);
});
