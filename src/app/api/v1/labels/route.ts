import { labelDto } from "@/lib/api/dto";
import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreateLabel } from "@/lib/api/ops";
import { getLabels } from "@/lib/data";

export const GET = withApiAuth(async (_req, auth) => {
  const rows = await getLabels(auth.workspaceId);
  return ok({ data: rows.map(labelDto), count: rows.length });
});

export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<Parameters<typeof apiCreateLabel>[1]>(req);
  const id = await apiCreateLabel(auth.workspaceId, body);
  const row = (await getLabels(auth.workspaceId)).find((l) => l.id === id);
  return ok({ data: row ? labelDto(row) : { id } }, 201);
});
