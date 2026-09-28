import { ok, withApiAuth } from "@/lib/api/http";
import { requireMemberName } from "@/lib/api/prospects";
import { loadWorkbook } from "@/lib/prospects/read";
import { todayIST } from "@/lib/prospects/stats";
import { myWork, parseScope } from "@/lib/prospects/views";

/**
 * The caller's queue for today, across every kind: follow-ups overdue, then
 * due today, then A-band valuers of theirs nobody has contacted. Each task
 * carries its drafts and phone/email so it can be acted on from the list.
 */
export const GET = withApiAuth(async (req, auth) => {
  const me = await requireMemberName(auth);
  const scope = parseScope(new URL(req.url).searchParams.get("scope"));
  const wb = await loadWorkbook();
  const today = todayIST();
  const data = myWork(wb, me, today, scope);
  return ok({ data, count: data.length, me, today, readAt: wb.readAt });
});
