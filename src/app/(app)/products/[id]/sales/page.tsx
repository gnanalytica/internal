import { notFound } from "next/navigation";

import { SalesView } from "@/components/sales-view";
import { isDepartmentEnabled } from "@/lib/departments";
import {
  getAccounts,
  getContacts,
  getDeals,
  getMembers,
  getProduct,
  getProjects,
  getWorkspace,
} from "@/lib/data";

export default async function ProductSalesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const product = await getProduct(ws.id, id);
  if (!product) notFound();
  if (!isDepartmentEnabled(product.enabledDepartments, "sales")) notFound();

  const [deals, accounts, contacts, members, products] = await Promise.all([
    getDeals(ws.id, id),
    getAccounts(ws.id),
    getContacts(ws.id),
    getMembers(ws.id),
    getProjects(ws.id),
  ]);

  return (
    <SalesView
      heading={`${product.name} · Sales`}
      scopeProductId={id}
      products={products}
      members={members}
      initialDeals={deals}
      initialAccounts={accounts}
      initialContacts={contacts}
    />
  );
}
