import { ticketDto } from "@/lib/api/dto";
import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreateTicket } from "@/lib/api/crm-ops";
import { getTickets } from "@/lib/data";

export const GET = withApiAuth(async (req, auth) => {
  const product = new URL(req.url).searchParams.get("product") ?? undefined;
  const rows = await getTickets(auth.workspaceId, product);
  return ok({ data: rows.map(ticketDto), count: rows.length });
});

export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<Parameters<typeof apiCreateTicket>[2]>(req);
  const id = await apiCreateTicket(auth.workspaceId, auth.userId, body);
  const row = (await getTickets(auth.workspaceId)).find((t) => t.id === id);
  return ok({ data: row ? ticketDto(row) : { id } }, 201);
});
