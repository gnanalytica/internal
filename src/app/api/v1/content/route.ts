import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreateContent } from "@/lib/api/dept-ops";
import { getContentItems } from "@/lib/data";

export const GET = withApiAuth(async (req, auth) => {
  const project = new URL(req.url).searchParams.get("project") ?? undefined;
  const rows = await getContentItems(auth.workspaceId, project);
  return ok({
    data: rows.map((c) => ({
      id: c.id,
      title: c.title,
      channel: c.channel,
      status: c.status,
      url: c.url,
      notes: c.notes,
      publishDate: c.publishDate,
      projectId: c.projectId,
      campaign: c.campaign ? { id: c.campaign.id, name: c.campaign.name } : null,
      ownerId: c.ownerId,
    })),
    count: rows.length,
  });
});

export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<Parameters<typeof apiCreateContent>[1]>(req);
  const id = await apiCreateContent(auth.workspaceId, body);
  return ok({ data: { id } }, 201);
});
