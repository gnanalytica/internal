import { issueDto } from "@/lib/api/dto";
import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreateIssue } from "@/lib/api/ops";
import { encodeCursor, pageParams } from "@/lib/api/pagination";
import { getIssue, getIssuesPage } from "@/lib/data";

export const GET = withApiAuth(async (req, auth) => {
  const url = new URL(req.url);
  const { limit, cursor } = pageParams(req.url);
  const { items, nextCursor } = await getIssuesPage(auth.workspaceId, {
    limit,
    cursor,
    status: url.searchParams.get("status"),
    projectId: url.searchParams.get("project"),
    assigneeId: url.searchParams.get("assignee"),
  });
  return ok({
    data: items.map(issueDto),
    next_cursor: nextCursor ? encodeCursor(nextCursor) : null,
  });
});

export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<Parameters<typeof apiCreateIssue>[2]>(req);
  const id = await apiCreateIssue(auth.workspaceId, auth.userId, body);
  const issue = await getIssue(auth.workspaceId, id);
  return ok({ data: issue ? issueDto(issue) : { id } }, 201);
});
