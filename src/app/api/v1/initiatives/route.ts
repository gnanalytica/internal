import { initiativeDto } from "@/lib/api/dto";
import { ok, withApiAuth } from "@/lib/api/http";
import { getInitiatives } from "@/lib/data";

export const GET = withApiAuth(async (_req, auth) => {
  const rows = await getInitiatives(auth.workspaceId);
  return ok({ data: rows.map(initiativeDto), count: rows.length });
});
