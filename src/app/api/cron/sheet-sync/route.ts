import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { isCronRequest } from "@/lib/cron-auth";
import { isSheetSyncConfigured } from "@/lib/sheet-crm/google-auth";
import { pullSheet } from "@/lib/sheet-crm/sync";

/**
 * Scheduled pull of the Valytica lead sheet (every 15 minutes, vercel.json).
 * A full read of every tab; only changed rows are written. Without the
 * service-account env the route answers 503 rather than pretending to sync.
 */
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!isCronRequest(req)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  if (!isSheetSyncConfigured()) return Response.json({ error: "Sheet sync is not configured." }, { status: 503 });
  // One workspace owns the sheet today; the env var is workspace-agnostic, so the
  // first workspace is the owner until a per-workspace setting exists.
  const [ws] = await db.select({ id: workspaces.id }).from(workspaces).limit(1);
  if (!ws) return Response.json({ error: "No workspace." }, { status: 503 });
  try {
    const { runId, summary } = await pullSheet(ws.id, "cron");
    return Response.json({ ok: true, runId, tabs: Object.keys(summary.tabs).length, contacts: summary.contactsUpserted, accounts: summary.accountsUpserted });
  } catch (err) {
    console.error("[sheet-sync] cron failed", err);
    return Response.json({ ok: false, error: "Sync failed; see the run log." }, { status: 500 });
  }
}
