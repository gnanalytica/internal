import { InitiativesView } from "@/components/initiatives-view";
import { getInitiatives, getWorkspace } from "@/lib/data";

export default async function InitiativesPage() {
  const ws = await getWorkspace();
  const initiatives = await getInitiatives(ws.id);
  return <InitiativesView initiatives={initiatives} />;
}
