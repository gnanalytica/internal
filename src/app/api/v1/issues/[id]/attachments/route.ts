import { apiAddAttachment, apiListAttachments } from "@/lib/api/collab-ops";
import { ok, readJson, withApiAuth } from "@/lib/api/http";

type Params = { id: string };

export const GET = withApiAuth<Params>(async (_req, auth, { id }) => {
  const data = await apiListAttachments(auth.workspaceId, id);
  return ok({ data, count: data.length });
});

export const POST = withApiAuth<Params>(async (req, auth, { id }) => {
  const body = await readJson<Parameters<typeof apiAddAttachment>[3]>(req);
  const attachmentId = await apiAddAttachment(auth.workspaceId, auth.userId, id, body);
  return ok({ data: { id: attachmentId } }, 201);
});
