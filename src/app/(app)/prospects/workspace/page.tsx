import { ProspectsWorkspace } from "@/components/prospects-dashboard/workspace";
import { getWorkspace } from "@/lib/data";
import { loadProspectsWorkspace } from "@/lib/prospects/page-data";

/**
 * The prospects workspace on its own, for a workspace without Valytica (whose
 * Sales tab is where prospects normally live). `/prospects` sends people here
 * only in that case; see `../route.ts`.
 */
export default async function ProspectsWorkspacePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ws = await getWorkspace();
  return <ProspectsWorkspace data={await loadProspectsWorkspace(ws.id, sp.scope === "all" ? "all" : "focus")} />;
}
