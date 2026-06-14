import { notFound } from "next/navigation";

import { MarketingView } from "@/components/marketing-view";
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
