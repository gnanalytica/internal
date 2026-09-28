import { ok, withApiAuth } from "@/lib/api/http";
import { apiUploadAttachment } from "@/lib/api/issue-extras";
import { assertIssueVisible, issueProject } from "@/lib/api/scope";
import { ApiInputError } from "@/lib/api/errors";

type Params = { id: string };

/** Upload a file (multipart field `file`, up to 10 MB) and attach it. */
export const POST = withApiAuth<Params>(async (req, auth, { id }) => {
  if ((await issueProject(auth.workspaceId, id)) === undefined) throw new ApiInputError("Issue not found.", 404);
  await assertIssueVisible(auth, id);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiInputError("Send the file as multipart/form-data.");
  }
  const data = await apiUploadAttachment(auth, id, form);
  return ok({ data }, 201);
});
