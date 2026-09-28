import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiPostStatusUpdate } from "@/lib/api/planning-ops";
import { assertProjectVisible } from "@/lib/api/scope";
import { getStatusUpdates } from "@/lib/data";

type Params = { id: string };

export const GET = withApiAuth<Params>(async (_req, auth, { id }) => {
  assertProjectVisible(auth, id, "Project");
  const rows = await getStatusUpdates(auth.workspaceId, id);
  const data = rows.map((u) => ({
    id: u.id,
    health: u.health,
    body: u.body,
    createdAt: u.createdAt,
    author: u.author ? { id: u.author.id, name: u.author.name } : null,
  }));
  return ok({ data, count: data.length });
});

/** Post a status update; the project's followers hear about it, as on the web. */
export const POST = withApiAuth<Params>(async (req, auth, { id }) => {
  const body = await readJson<{ health?: string; body?: string }>(req);
  const updateId = await apiPostStatusUpdate(auth, id, body);
  return ok({ data: { id: updateId, projectId: id } }, 201);
});
