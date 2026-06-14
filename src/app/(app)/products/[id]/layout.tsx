import { notFound } from "next/navigation";

import { ProductTabs } from "@/components/product-tabs";
import { getProduct, getWorkspace } from "@/lib/data";

export default async function ProductLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const product = await getProduct(ws.id, id);
  if (!product) notFound();

  return (
    <div className="flex h-full flex-col">
      <ProductTabs product={product} />
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
