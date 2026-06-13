import { issueDto } from "@/lib/api/dto";
import { notFound, ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiDeleteIssue, apiUpdateIssue } from "@/lib/api/ops";
import { getIssue } from "@/lib/data";

type Params = { id: string };

export const GET = withApiAuth<Params>(async (_req, auth, { id }) => {
  const issue = await getIssue(auth.workspaceId, id);
  return issue ? ok({ data: issueDto(issue) }) : notFound("Issue");
});

export const PATCH = withApiAuth<Params>(async (req, auth, { id }) => {
  const body = await readJson(req);
  const updated = await apiUpdateIssue(auth.workspaceId, id, body);
  if (!updated) return notFound("Issue");
  const issue = await getIssue(auth.workspaceId, id);
  return ok({ data: issue ? issueDto(issue) : { id } });
});

export const DELETE = withApiAuth<Params>(async (_req, auth, { id }) => {
  const deleted = await apiDeleteIssue(auth.workspaceId, id);
  return deleted ? ok({ deleted: true }) : notFound("Issue");
});
