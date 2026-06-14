import { MarketingView } from "@/components/marketing-view";
import {
  getCampaigns,
  getContentItems,
  getProjects,
  getWorkspace,
} from "@/lib/data";

export default async function MarketingPage() {
  const ws = await getWorkspace();
  const [campaigns, content, products] = await Promise.all([
    getCampaigns(ws.id),
    getContentItems(ws.id),
    getProjects(ws.id),
  ]);

  return (
    <MarketingView
      heading="Marketing · all products"
      scopeProductId={null}
      products={products}
      initialCampaigns={campaigns}
      initialContent={content}
    />
  );
}
