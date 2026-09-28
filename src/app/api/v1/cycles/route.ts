import { cycleDto } from "@/lib/api/dto";
import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreateCycle } from "@/lib/api/ops";
import { apiCycleList } from "@/lib/api/planning-ops";
import { assertProjectVisible } from "@/lib/api/scope";
import { getCyclesFlat } from "@/lib/data";

/**
 * Cycles with their project and progress. `?project=<id>` narrows to one
 * project and adds that project's velocity over its finished cycles.
 */
export const GET = withApiAuth(async (req, auth) => {
  const project = new URL(req.url).searchParams.get("project");
  const { data, velocity } = await apiCycleList(auth, project);
  return ok({ data, count: data.length, ...(velocity ? { velocity } : {}) });
});

export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<Parameters<typeof apiCreateCycle>[1]>(req);
  assertProjectVisible(auth, body.projectId, "Project");
  const id = await apiCreateCycle(auth.workspaceId, body);
  const row = (await getCyclesFlat(auth.workspaceId)).find((c) => c.id === id);
  return ok({ data: row ? { ...cycleDto(row), projectId: row.projectId } : { id } }, 201);
});
