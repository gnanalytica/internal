import { ProspectsView } from "@/components/prospects/prospects-view";
import { getWorkspace } from "@/lib/data";
import { loadProspectsData } from "@/lib/sheet-crm/workspace-data";

/** Workspace-wide view of the lead sheet (the same surface as the Valytica project's Sales). */
export default async function ProspectsPage() {
  const ws = await getWorkspace();
  const data = await loadProspectsData(ws.id);
  return <ProspectsView heading="Prospects" data={data} />;
}
