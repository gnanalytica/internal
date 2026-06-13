import { InsightsView } from "@/components/insights-view";
import { getInsights, getWorkspace } from "@/lib/data";

export default async function InsightsPage() {
  const ws = await getWorkspace();
  const insights = await getInsights(ws.id);
  return <InsightsView insights={insights} />;
}
