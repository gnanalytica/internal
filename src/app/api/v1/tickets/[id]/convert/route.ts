import { apiConvertTicketToIssue } from "@/lib/api/business-ops";
import { issueDto } from "@/lib/api/dto";
import { ok, withApiAuth } from "@/lib/api/http";
import { assertRecordAccess } from "@/lib/api/scope";
import { getIssue } from "@/lib/data";

type Params = { id: string };

/**
 * Turn a support ticket into a task (the web's "Convert to task"). Idempotent:
 * a ticket already converted answers 200 with the task it became; a new
 * conversion answers 201.
 */
export const POST = withApiAuth<Params>(async (_req, auth, { id }) => {
  await assertRecordAccess(auth, "tickets", id);
  const { issueId, created } = await apiConvertTicketToIssue(auth.workspaceId, auth.userId, id);
  const issue = await getIssue(auth.workspaceId, issueId);
  return ok({ data: { issue: issue ? issueDto(issue) : { id: issueId }, created } }, created ? 201 : 200);
});
