import { issueDetailDto, issueDto } from "@/lib/api/dto";
import { notFound, ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiDeleteIssue, apiUpdateIssue } from "@/lib/api/ops";
import {
  apiListIssueComments,
  apiListIssueRelations,
} from "@/lib/api/collab-ops";
import { getIssue } from "@/lib/data";

type Params = { id: string };

export const GET = withApiAuth<Params>(async (_req, auth, { id }) => {
  const issue = await getIssue(auth.workspaceId, id);
  if (!issue) return notFound("Issue");
  const [comments, relations] = await Promise.all([
    apiListIssueComments(auth.workspaceId, id),
    apiListIssueRelations(auth.workspaceId, id),
  ]);
  return ok({ data: { ...issueDetailDto(issue), comments, relations } });
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
