import { ok, withApiAuth } from "@/lib/api/http";
import { apiError } from "@/lib/api/http";
import { getSheetSyncRuns } from "@/lib/sheet-crm/queries";
import { isSheetSyncConfigured } from "@/lib/sheet-crm/google-auth";
import { pullSheet } from "@/lib/sheet-crm/sync";

export const maxDuration = 300;

/** Recent sync runs, newest first. */
export const GET = withApiAuth(async (_req, auth) => {
  const runs = await getSheetSyncRuns(auth.workspaceId, 20);
  return ok({ data: runs, configured: isSheetSyncConfigured() });
});

/** Start a pull now. Synchronous: the response carries the run summary. */
export const POST = withApiAuth(async (_req, auth) => {
  if (!isSheetSyncConfigured()) return apiError("Sheet sync is not configured on this deployment.", 503);
  const { runId, summary } = await pullSheet(auth.workspaceId, "api");
  return ok({ data: { runId, summary } });
});
