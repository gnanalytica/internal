import { ok, withApiAuth } from "@/lib/api/http";
import { apiIssueTimeline } from "@/lib/api/issue-extras";
import { assertIssueVisible, issueProject } from "@/lib/api/scope";
import { ApiInputError } from "@/lib/api/errors";

type Params = { id: string };

/** Comments and change history, merged oldest first. */
export const GET = withApiAuth<Params>(async (_req, auth, { id }) => {
  if ((await issueProject(auth.workspaceId, id)) === undefined) throw new ApiInputError("Issue not found.", 404);
  await assertIssueVisible(auth, id);
  const data = await apiIssueTimeline(auth, id);
  return ok({ data, count: data.length });
});
