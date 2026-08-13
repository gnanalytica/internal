import { cycleDto } from "@/lib/api/dto";
import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreateCycle } from "@/lib/api/ops";
import { getCycles, getCyclesFlat } from "@/lib/data";

export const GET = withApiAuth(async (_req, auth) => {
  const rows = await getCycles(auth.workspaceId);
  return ok({ data: rows.map(cycleDto), count: rows.length });
});

export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<Parameters<typeof apiCreateCycle>[1]>(req);
  const id = await apiCreateCycle(auth.workspaceId, body);
  const row = (await getCyclesFlat(auth.workspaceId)).find((c) => c.id === id);
  return ok({ data: row ? cycleDto(row) : { id } }, 201);
});
