import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreateFeedback } from "@/lib/api/dept-ops";
import { getFeedback } from "@/lib/data";

export const GET = withApiAuth(async (req, auth) => {
  const project = new URL(req.url).searchParams.get("project") ?? undefined;
  const rows = await getFeedback(auth.workspaceId, project);
  return ok({
    data: rows.map((f) => ({
      id: f.id,
      title: f.title,
      body: f.body,
      source: f.source,
      status: f.status,
      votes: f.votes,
      contact: f.contact,
      featureId: f.featureId,
      projectId: f.projectId,
      createdAt: f.createdAt,
    })),
    count: rows.length,
  });
});

export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<Parameters<typeof apiCreateFeedback>[1]>(req);
  const id = await apiCreateFeedback(auth.workspaceId, body);
  return ok({ data: { id } }, 201);
});
