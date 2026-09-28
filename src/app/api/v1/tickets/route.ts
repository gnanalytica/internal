import { ticketDto } from "@/lib/api/dto";
import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreateTicket } from "@/lib/api/crm-ops";
import { getTickets } from "@/lib/data";
import { assertProjectVisible, visibleRows } from "@/lib/api/scope";

export const GET = withApiAuth(async (req, auth) => {
  const project = new URL(req.url).searchParams.get("project") ?? undefined;
  const rows = visibleRows(auth, await getTickets(auth.workspaceId, project), (r) => r.projectId);
  return ok({ data: rows.map(ticketDto), count: rows.length });
});

export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<Parameters<typeof apiCreateTicket>[2]>(req);
  assertProjectVisible(auth, (body as { projectId?: string | null }).projectId, "Project");
  const id = await apiCreateTicket(auth.workspaceId, auth.userId, body);
  const row = (await getTickets(auth.workspaceId)).find((t) => t.id === id);
  return ok({ data: row ? ticketDto(row) : { id } }, 201);
});
