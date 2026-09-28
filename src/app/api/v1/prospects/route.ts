import { apiError, ok, withApiAuth } from "@/lib/api/http";
import { memberName, teamNames } from "@/lib/api/prospects";
import { loadWorkbook } from "@/lib/prospects/read";
import { prospectsSheetUrl } from "@/lib/prospects/schema";
import { todayIST } from "@/lib/prospects/stats";
import { kindCounts, parseKind, parseScope, scopedRows } from "@/lib/prospects/views";

/**
 * One kind's prospects, read from the prospects Google Sheet: `?kind=` valuer
 * (default), firm, rvo, panel or bank; `?scope=focus` (KA · AP · TS, default)
 * or `all`. Rows are the slim list shape the web ships to the browser — the
 * full record is `GET /prospects/{kind}/{id}`. Also carries what the list's
 * switches and filters need: counts per kind, the team, and who is asking.
 */
export const GET = withApiAuth(async (req, auth) => {
  const sp = new URL(req.url).searchParams;
  const kind = sp.get("kind") ? parseKind(sp.get("kind")) : "valuer";
  if (!kind) return apiError("kind must be valuer, firm, rvo, panel or bank.", 400);
  const scope = parseScope(sp.get("scope"));
  const [wb, team, me] = await Promise.all([loadWorkbook(), teamNames(auth.workspaceId), memberName(auth)]);
  const rows = scopedRows(wb, kind, scope);
  return ok({
    data: rows,
    count: rows.length,
    kind,
    scope,
    ...kindCounts(wb, scope),
    today: todayIST(),
    readAt: wb.readAt,
    warnings: wb.warnings,
    sheetUrl: prospectsSheetUrl(),
    me: me ?? "",
    team,
  });
});
