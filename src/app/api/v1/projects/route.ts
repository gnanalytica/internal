import { projectDto } from "@/lib/api/dto";
import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreateProjectFull } from "@/lib/api/planning-ops";
import { getProjects } from "@/lib/data";
import { visibleRows } from "@/lib/api/scope";

export const GET = withApiAuth(async (_req, auth) => {
  const rows = visibleRows(auth, await getProjects(auth.workspaceId), (p) => p.id);
  return ok({ data: rows.map(projectDto), count: rows.length });
});

/** Create a project or an operation (`kind`), optionally with its owner. */
export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<{ name?: string; key?: string; description?: string; kind?: string; ownerId?: string | null }>(req);
  const id = await apiCreateProjectFull(auth, body);
  const project = (await getProjects(auth.workspaceId)).find((p) => p.id === id);
  return ok({ data: project ? projectDto(project) : { id } }, 201);
});
