import { dealDto } from "@/lib/api/dto";
import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreateDeal } from "@/lib/api/crm-ops";
import { getDeals } from "@/lib/data";

export const GET = withApiAuth(async (req, auth) => {
  const project = new URL(req.url).searchParams.get("project") ?? undefined;
  const rows = await getDeals(auth.workspaceId, project);
  return ok({ data: rows.map(dealDto), count: rows.length });
});

export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<Parameters<typeof apiCreateDeal>[2]>(req);
  const id = await apiCreateDeal(auth.workspaceId, auth.userId, body);
  const row = (await getDeals(auth.workspaceId)).find((d) => d.id === id);
  return ok({ data: row ? dealDto(row) : { id } }, 201);
});
