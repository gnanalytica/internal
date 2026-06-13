import { issueDto } from "@/lib/api/dto";
import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreateIssue } from "@/lib/api/ops";
import { getIssue, getIssues } from "@/lib/data";

export const GET = withApiAuth(async (req, auth) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const project = url.searchParams.get("project");
  const assignee = url.searchParams.get("assignee");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100) || 100, 200);

  let rows = await getIssues(auth.workspaceId);
  if (status) rows = rows.filter((i) => i.status === status);
  if (project) rows = rows.filter((i) => i.projectId === project);
  if (assignee) rows = rows.filter((i) => i.assigneeId === assignee);

  return ok({ data: rows.slice(0, limit).map(issueDto), count: rows.length });
});

export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<Parameters<typeof apiCreateIssue>[2]>(req);
  const id = await apiCreateIssue(auth.workspaceId, auth.userId, body);
  const issue = await getIssue(auth.workspaceId, id);
  return ok({ data: issue ? issueDto(issue) : { id } }, 201);
});
