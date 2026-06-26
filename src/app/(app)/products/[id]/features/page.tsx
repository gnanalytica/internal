import { notFound } from "next/navigation";

import { FeaturesView } from "@/components/features-view";
import { isDepartmentEnabled } from "@/lib/departments";
import { getFeatures, getProduct, getWorkspace } from "@/lib/data";

export default async function ProductFeaturesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const product = await getProduct(ws.id, id);
  if (!product) notFound();
  if (!isDepartmentEnabled(product.enabledDepartments, "features")) notFound();

  const features = await getFeatures(ws.id, id);

  return (
    <FeaturesView
      heading={`${product.name} · Product`}
      features={features}
      nowISO={new Date().toISOString()}
      scopeProductId={id}
    />
  );
}
