import { FeaturesView } from "@/components/features-view";
import { getFeatures, getWorkspace } from "@/lib/data";

export default async function FeaturesPage() {
  const ws = await getWorkspace();
  const features = await getFeatures(ws.id);

  return (
    <FeaturesView
      heading="Features · all projects"
      features={features}
      nowISO={new Date().toISOString()}
      scopeProjectId={null}
      groupByProject
    />
  );
}
