import { CyclesView } from "@/components/cycles-view";
import { getCycles, getWorkspace } from "@/lib/data";

export default async function CyclesPage() {
  const ws = await getWorkspace();
  const cycles = await getCycles(ws.id);
  return <CyclesView cycles={cycles} />;
}
