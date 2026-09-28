import { apiError, ok, withApiAuth } from "@/lib/api/http";
import { requireMemberName, teamNames } from "@/lib/api/prospects";
import { loadWorkbook } from "@/lib/prospects/read";
import { buildOverview, todayIST, type Period } from "@/lib/prospects/stats";
import { parseKind, parseScope, scopedRows } from "@/lib/prospects/views";

const PERIODS: readonly Period[] = ["week", "month", "all"];

/**
 * The Overview tab's numbers for one kind: `?kind=`, `?scope=`, `?period=`
 * week (default) | month | all, and `?who=` team (default) | me.
 */
export const GET = withApiAuth(async (req, auth) => {
  const sp = new URL(req.url).searchParams;
  const kind = sp.get("kind") ? parseKind(sp.get("kind")) : "valuer";
  if (!kind) return apiError("kind must be valuer, firm, rvo, panel or bank.", 400);
  const period = (PERIODS as readonly string[]).includes(sp.get("period") ?? "") ? (sp.get("period") as Period) : "week";
  const who = sp.get("who") === "me" ? "me" : "team";
  const person = who === "me" ? await requireMemberName(auth) : null;
  const [wb, team] = await Promise.all([loadWorkbook(), teamNames(auth.workspaceId)]);
  const today = todayIST();
  const data = buildOverview({ rows: scopedRows(wb, kind, parseScope(sp.get("scope"))), activity: wb.activity, today, period, person, team });
  return ok({ data, kind, period, who, today, readAt: wb.readAt });
});
