import { notFound } from "next/navigation";

import { MarketingView } from "@/components/marketing-view";
import { isDepartmentEnabled } from "@/lib/departments";
import {
  getCampaigns,
  getContentItems,
  getProduct,
  getProjects,
  getWorkspace,
} from "@/lib/data";

export default async function ProductMarketingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const product = await getProduct(ws.id, id);
  if (!product) notFound();
  if (!isDepartmentEnabled(product.enabledDepartments, "marketing")) notFound();

  const [campaigns, content, products] = await Promise.all([
    getCampaigns(ws.id, id),
    getContentItems(ws.id, id),
    getProjects(ws.id),
  ]);

  return (
    <MarketingView
      heading={`${product.name} · Marketing`}
      scopeProductId={id}
      products={products}
      initialCampaigns={campaigns}
      initialContent={content}
    />
  );
}
