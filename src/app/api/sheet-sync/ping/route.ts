import { timingSafeEqual } from "node:crypto";

import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { isSheetSyncConfigured } from "@/lib/sheet-crm/google-auth";
import { isTabId } from "@/lib/sheet-crm/mapping";
import { pullSheet } from "@/lib/sheet-crm/sync";

/**
 * Near-real-time hook for an Apps Script `onEdit` trigger in the workbook:
 *
 *   UrlFetchApp.fetch("https://internal.gnanalytica.com/api/sheet-sync/ping", {
 *     method: "post", contentType: "application/json",
 *     headers: { "X-Sheet-Sync-Secret": "<SHEET_SYNC_SECRET>" },
 *     payload: JSON.stringify({ tab: e.source.getActiveSheet().getName() }),
 *   });
 *
 * The body names the edited TAB TITLE; the handler maps it to a tab id via
 * the last successful run and pulls that tab only. Anything it cannot map
 * falls back to a full pull. Fails closed without a secret.
 */
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.SHEET_SYNC_SECRET;
  const given = req.headers.get("x-sheet-sync-secret") ?? "";
  if (!secret || secret.length < 16 || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  if (!isSheetSyncConfigured()) return Response.json({ error: "Sheet sync is not configured." }, { status: 503 });
  const [ws] = await db.select({ id: workspaces.id }).from(workspaces).limit(1);
  if (!ws) return Response.json({ error: "No workspace." }, { status: 503 });
  let tab: string | undefined;
  try {
    const body = (await req.json()) as { tab?: string; tabId?: string };
    tab = body.tabId ?? body.tab;
  } catch {
    /* empty body → full pull */
  }
  const onlyTabs = tab && isTabId(tab) ? [tab] : undefined;
  try {
    const { runId } = await pullSheet(ws.id, "ping", onlyTabs ? { onlyTabs } : {});
    return Response.json({ ok: true, runId, scope: onlyTabs ?? "all" });
  } catch (err) {
    console.error("[sheet-sync] ping failed", err);
    return Response.json({ ok: false }, { status: 500 });
  }
}
