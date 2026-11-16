import { apiError, ok, withApiAuth } from "@/lib/api/http";
import { requireMemberName, teamNames } from "@/lib/api/prospects";
import { loadProspectSnapshot } from "@/lib/prospects/read";
import { buildOverview, dateSpan, todayIST, type Period } from "@/lib/prospects/stats";
import { parseKind, parseScope, scopedRows } from "@/lib/prospects/views";

const PERIODS: readonly Period[] = ["today", "week", "month", "all"];

/**
 * The Overview tab's numbers for one kind: `?kind=`, `?scope=`, `?period=`
 * today | week (default) | month | all, or `?from=&to=` (yyyy-mm-dd, both
 * included) for picked dates, and `?who=` team (default) | me.
 */
export const GET = withApiAuth(async (req, auth) => {
  const sp = new URL(req.url).searchParams;
  const kind = sp.get("kind") ? parseKind(sp.get("kind")) : "valuer";
  if (!kind) return apiError("kind must be valuer, firm, rvo, panel or bank.", 400);
  const span = dateSpan(sp.get("from"), sp.get("to"));
  const named = (PERIODS as readonly unknown[]).includes(sp.get("period") ?? "") ? (sp.get("period") as Period) : "week";
  const period: Period = span ?? named;
  const who = sp.get("who") === "me" ? "me" : "team";
  const person = who === "me" ? await requireMemberName(auth) : null;
  const [wb, team] = await Promise.all([loadProspectSnapshot(), teamNames(auth.workspaceId)]);
  const today = todayIST();
  const data = buildOverview({ rows: scopedRows(wb, kind, parseScope(sp.get("scope"))), activity: wb.activity, today, period, person, team });
  return ok({ data, kind, period, who, today, readAt: wb.readAt });
});
