import { DatabasesView } from "@/components/databases-view";
import { getDatabases, getWorkspace } from "@/lib/data";

export default async function DatabasesPage() {
  const ws = await getWorkspace();
  const databases = await getDatabases(ws.id);
  return <DatabasesView databases={databases} />;
}
