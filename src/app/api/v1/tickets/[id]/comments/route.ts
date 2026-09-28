import { apiCreateTicketComment } from "@/lib/api/crm-ops";
import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { assertRecordAccess } from "@/lib/api/scope";

type Params = { id: string };

export const POST = withApiAuth<Params>(async (req, auth, { id }) => {
  await assertRecordAccess(auth, "tickets", id);
  const { body } = await readJson<{ body?: string }>(req);
  const commentId = await apiCreateTicketComment(
    auth.workspaceId,
    auth.userId,
    id,
    body ?? "",
  );
  return ok({ data: { id: commentId, ticketId: id } }, 201);
});
