import { LabelsSettings } from "@/components/labels-settings";
import { getLabels, getWorkspace } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function LabelsSettingsPage() {
  const ws = await getWorkspace();
  const labels = await getLabels(ws.id);
  return <LabelsSettings labels={labels} />;
}
