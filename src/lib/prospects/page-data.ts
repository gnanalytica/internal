import "server-only";

import type { WorkspaceData } from "@/components/prospects-dashboard/workspace";
import { getCurrentUser, getMembers } from "@/lib/data";
import { loadWorkbook } from "./read";
import { prospectsSheetUrl } from "./schema";
import { inFocus, todayIST, toRow } from "./stats";

/** Everything the prospects workspace renders, read from the sheet for one workspace. */
export async function loadProspectsWorkspace(workspaceId: string, scope: "focus" | "all"): Promise<WorkspaceData> {
  const [me, members, wb] = await Promise.all([getCurrentUser(workspaceId), getMembers(workspaceId), loadWorkbook()]);
  const scoped = (list: typeof wb.valuers) => list.filter((r) => scope === "all" || inFocus(r)).map(toRow);
  return {
    rows: { valuer: scoped(wb.valuers), firm: scoped(wb.firms), rvo: scoped(wb.rvos), panel: scoped(wb.panels), bank: scoped(wb.banks) },
    totals: { valuer: wb.valuers.length, firm: wb.firms.length, rvo: wb.rvos.length, panel: wb.panels.length, bank: wb.banks.length },
    activity: wb.activity,
    today: todayIST(),
    readAt: wb.readAt,
    warnings: wb.warnings,
    sheetUrl: prospectsSheetUrl(),
    me: (me.name || me.email || "").trim(),
    team: members.map((m) => (m.name || m.email || "").trim()).filter(Boolean),
    scope,
  };
}
