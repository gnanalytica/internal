import { FeaturesView } from "@/components/features-view";
import { getFeatures, getWorkspace } from "@/lib/data";

export default async function FeaturesPage() {
  const ws = await getWorkspace();
  const features = await getFeatures(ws.id);

  return (
    <FeaturesView
      heading="Product · all products"
      features={features}
      nowISO={new Date().toISOString()}
      scopeProductId={null}
      groupByProduct
    />
  );
}
