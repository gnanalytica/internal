import { cycleDto } from "@/lib/api/dto";
import { ok, withApiAuth } from "@/lib/api/http";
import { getCycles } from "@/lib/data";

export const GET = withApiAuth(async (_req, auth) => {
  const rows = await getCycles(auth.workspaceId);
  return ok({ data: rows.map(cycleDto), count: rows.length });
});
