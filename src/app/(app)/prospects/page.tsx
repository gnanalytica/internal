import { ProspectsWorkspace } from "@/components/prospects-dashboard/workspace";
import { getCurrentUser, getMembers, getProjects, getWorkspace } from "@/lib/data";
import { loadWorkbook } from "@/lib/prospects/read";
import { PROSPECTS_PRODUCT_KEY, prospectsSheetUrl } from "@/lib/prospects/schema";
import { inFocus, todayIST, toRow } from "@/lib/prospects/stats";

/** Valytica's prospects, read straight from the prospects Google Sheet. */
export default async function ProspectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const scope = sp.scope === "all" ? "all" : "focus";
  const ws = await getWorkspace();
  const [me, members, projects, wb] = await Promise.all([getCurrentUser(ws.id), getMembers(ws.id), getProjects(ws.id), loadWorkbook()]);
  const product = projects.find((p) => p.key === PROSPECTS_PRODUCT_KEY);
  const scoped = (list: typeof wb.valuers) => list.filter((r) => scope === "all" || inFocus(r)).map(toRow);
  return (
    <ProspectsWorkspace
      data={{
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
        product: product ? { id: product.id, name: product.name, color: product.color } : null,
      }}
    />
  );
}
