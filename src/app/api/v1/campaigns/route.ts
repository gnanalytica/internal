import { campaignDto } from "@/lib/api/dto";
import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreateCampaign } from "@/lib/api/crm-ops";
import { getCampaigns } from "@/lib/data";
import { assertProjectVisible, visibleRows } from "@/lib/api/scope";

export const GET = withApiAuth(async (req, auth) => {
  const project = new URL(req.url).searchParams.get("project") ?? undefined;
  const rows = visibleRows(auth, await getCampaigns(auth.workspaceId, project), (r) => r.projectId);
  return ok({ data: rows.map(campaignDto), count: rows.length });
});

export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<Parameters<typeof apiCreateCampaign>[2]>(req);
  assertProjectVisible(auth, (body as { projectId?: string | null }).projectId, "Project");
  const id = await apiCreateCampaign(auth.workspaceId, auth.userId, body);
  const row = (await getCampaigns(auth.workspaceId)).find((c) => c.id === id);
  return ok({ data: row ? campaignDto(row) : { id } }, 201);
});
