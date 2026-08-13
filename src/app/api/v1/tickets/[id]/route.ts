import { ticketDto } from "@/lib/api/dto";
import { notFound, ok, withApiAuth } from "@/lib/api/http";
import { recordRoute } from "@/lib/api/record-route";
import { getTicket, getTicketComments } from "@/lib/data";

type Params = { id: string };

export const GET = withApiAuth<Params>(async (_req, auth, { id }) => {
  const ticket = await getTicket(auth.workspaceId, id);
  if (!ticket) return notFound("Ticket");
  const comments = await getTicketComments(auth.workspaceId, id);
  return ok({
    data: {
      ...ticketDto(ticket),
      body: ticket.body,
      comments: comments.map((c) => ({
        id: c.id,
        body: c.body,
        author: c.author ? { id: c.author.id, name: c.author.name } : null,
        createdAt: c.createdAt,
      })),
    },
  });
});

const handlers = recordRoute("tickets");

export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
