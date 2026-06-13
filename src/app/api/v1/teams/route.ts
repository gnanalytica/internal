import { teamDto } from "@/lib/api/dto";
import { ok, withApiAuth } from "@/lib/api/http";
import { getTeams } from "@/lib/data";

export const GET = withApiAuth(async (_req, auth) => {
  const rows = await getTeams(auth.workspaceId);
  return ok({ data: rows.map(teamDto), count: rows.length });
});
