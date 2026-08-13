import { apiDeleteMetricPoint } from "@/lib/api/dept-ops";
import { notFound, ok, withApiAuth } from "@/lib/api/http";

type Params = { id: string; pointId: string };

export const DELETE = withApiAuth<Params>(async (_req, auth, { id, pointId }) => {
  const deleted = await apiDeleteMetricPoint(auth.workspaceId, id, pointId);
  return deleted ? ok({ data: { id: pointId }, deleted: true }) : notFound("Point");
});
