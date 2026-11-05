import { redirect } from "next/navigation";

import { ProspectsWorkspace } from "@/components/prospects-dashboard/workspace";
import { getProjects, getWorkspace } from "@/lib/data";
import { loadProspectsWorkspace } from "@/lib/prospects/page-data";
import { PROSPECTS_PRODUCT_KEY } from "@/lib/prospects/schema";

/**
 * Prospects are Valytica's Sales tab, so this short link lands there with any
 * view, list or record in the query string kept. A workspace without Valytica
 * still gets the workspace on its own.
 */
export default async function ProspectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ws = await getWorkspace();
  const product = (await getProjects(ws.id)).find((p) => p.key === PROSPECTS_PRODUCT_KEY);
  if (product) {
    const qs = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (v === undefined ? [] : [[k, Array.isArray(v) ? v[0] : v]]))).toString();
    redirect(`/projects/${product.id}/sales${qs ? `?${qs}` : ""}`);
  }
  return <ProspectsWorkspace data={await loadProspectsWorkspace(ws.id, sp.scope === "all" ? "all" : "focus")} />;
}
