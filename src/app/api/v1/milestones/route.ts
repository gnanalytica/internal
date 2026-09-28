import { milestoneDto } from "@/lib/api/dto";
import { apiError, ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreateMilestone } from "@/lib/api/ops";
import { getMilestones } from "@/lib/data";
import { assertProjectVisible, visibleRows } from "@/lib/api/scope";

/** Milestones are project phases, so a project is required to list them. */
export const GET = withApiAuth(async (req, auth) => {
  const project = new URL(req.url).searchParams.get("project");
  if (!project)
    return apiError("`?project=<id>` is required — milestones are per project.", 400);
  const rows = visibleRows(auth, await getMilestones(auth.workspaceId, project), (r) => r.projectId);
  return ok({ data: rows.map(milestoneDto), count: rows.length });
});

export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<Parameters<typeof apiCreateMilestone>[1]>(req);
  assertProjectVisible(auth, (body as { projectId?: string | null }).projectId, "Project");
  const id = await apiCreateMilestone(auth.workspaceId, body);
  const row = body.projectId
    ? (await getMilestones(auth.workspaceId, body.projectId)).find((m) => m.id === id)
    : undefined;
  return ok({ data: row ? milestoneDto(row) : { id } }, 201);
});
