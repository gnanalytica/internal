import { redirect } from "next/navigation";

import { ProspectsWorkspace } from "@/components/prospects-dashboard/workspace";
import { Restricted } from "@/components/restricted";
import { canSeeConfidential } from "@/lib/departments";
import { getMyRole, getProjects, getWorkspace } from "@/lib/data";
import { loadProspectsWorkspace } from "@/lib/prospects/page-data";
import { PROSPECTS_PRODUCT_KEY } from "@/lib/prospects/schema";

/**
 * The prospects workspace on its own, for a workspace without Valytica (whose
 * Sales tab is where prospects normally live). `/prospects` sends people here
 * only in that case; see `../route.ts`.
 *
 * Gated like the Sales tab: the sheet is one shared workbook, so this page must
 * never be a way round that tab's admin check. A workspace that does have
 * Valytica is sent to the tab itself, which does its own gating.
 */
export default async function ProspectsWorkspacePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ws = await getWorkspace();
  const [projects, role] = await Promise.all([getProjects(ws.id), getMyRole(ws.id)]);
  const scope = sp.scope === "all" ? "all" : "focus";
  const product = projects.find((p) => p.key === PROSPECTS_PRODUCT_KEY);
  if (product) redirect(`/projects/${product.id}/sales${scope === "all" ? "?scope=all" : ""}`);
  if (!canSeeConfidential(role)) return <Restricted label="Sales" />;
  return <ProspectsWorkspace data={await loadProspectsWorkspace(ws.id, scope)} />;
}
