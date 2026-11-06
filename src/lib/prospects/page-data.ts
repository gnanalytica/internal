import "server-only";

import type { WorkspaceData } from "@/components/prospects-dashboard/workspace";
import { getCurrentUser, getMembers } from "@/lib/data";
import { loadProspectSnapshot } from "./read";
import { prospectsSheetUrl } from "./schema";
import { inFocus, todayIST, type ProspectRow } from "./stats";

/** Everything the prospects workspace renders, read from the sheet for one workspace. */
export async function loadProspectsWorkspace(workspaceId: string, scope: "focus" | "all"): Promise<WorkspaceData> {
  const [me, members, snap] = await Promise.all([getCurrentUser(workspaceId), getMembers(workspaceId), loadProspectSnapshot()]);
  const { rows } = snap;
  const scoped = (list: ProspectRow[]) => (scope === "all" ? list : list.filter(inFocus));
  return {
    rows: { valuer: scoped(rows.valuer), firm: scoped(rows.firm), rvo: scoped(rows.rvo), panel: scoped(rows.panel), bank: scoped(rows.bank) },
    totals: { valuer: rows.valuer.length, firm: rows.firm.length, rvo: rows.rvo.length, panel: rows.panel.length, bank: rows.bank.length },
    activity: snap.activity,
    today: todayIST(),
    readAt: snap.readAt,
    warnings: snap.warnings,
    sheetUrl: prospectsSheetUrl(),
    me: (me.name || me.email || "").trim(),
    team: members.map((m) => (m.name || m.email || "").trim()).filter(Boolean),
    scope,
  };
}
