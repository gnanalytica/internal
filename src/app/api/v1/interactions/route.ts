import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreateInteraction, apiListInteractions, type InteractionInput } from "@/lib/api/people-ops";

/** Timeline entries. `?person=P#####` or `?contact=<uuid>` or `?account=<uuid>`, `?since=<iso>`, `?limit=`. */
export const GET = withApiAuth(async (req, auth) => {
  const sp = new URL(req.url).searchParams;
  const rows = await apiListInteractions(auth.workspaceId, {
    personId: sp.get("person"),
    contactId: sp.get("contact"),
    accountId: sp.get("account"),
    since: sp.get("since"),
    limit: Number(sp.get("limit") ?? 100) || 100,
  });
  return ok({ data: rows, count: rows.length });
});

/**
 * Log an interaction. Standup AI posts a meeting summary here:
 *   { "personId": "P00145", "channel": "meeting", "held": true, "source": "standup-ai",
 *     "externalRef": "summary:2026-09-21", "occurredAt": "…", "subject": "Call with …",
 *     "summary": "…", "externalUrl": "https://standup.gnanalytica.com/…",
 *     "meta": { "actionItems": [...], "decisions": [...] } }
 * Idempotent on (source, externalRef): a retry answers 200 with the same id.
 */
export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<InteractionInput>(req);
  const r = await apiCreateInteraction(auth.workspaceId, auth.userId, body);
  return ok({ data: { id: r.id, newStatus: r.newStatus } }, r.created ? 201 : 200);
});
