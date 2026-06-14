import { ProductsView } from "@/components/products-view";
import { getProductSummaries, getWorkspace } from "@/lib/data";

export default async function ProductsPage() {
  const ws = await getWorkspace();
  const products = await getProductSummaries(ws.id);
  return <ProductsView products={products} />;
}
