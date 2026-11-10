import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreateContent } from "@/lib/api/dept-ops";
import { getContentItems } from "@/lib/data";
import { assertProjectVisible, visibleRows } from "@/lib/api/scope";

export const GET = withApiAuth(async (req, auth) => {
  const project = new URL(req.url).searchParams.get("project") ?? undefined;
  const rows = visibleRows(auth, await getContentItems(auth.workspaceId, project), (r) => r.projectId);
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
      // What the web's Marketing plans by: the piece's format, its format's
      // fields, and the results typed in after it goes out. Added fields only.
      format: c.format,
      details: c.details,
      views: c.views,
      clicks: c.clicks,
    })),
    count: rows.length,
  });
});

export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<Parameters<typeof apiCreateContent>[1]>(req);
  assertProjectVisible(auth, (body as { projectId?: string | null }).projectId, "Project");
  const id = await apiCreateContent(auth.workspaceId, body);
  return ok({ data: { id } }, 201);
});
