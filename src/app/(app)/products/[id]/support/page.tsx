import { notFound } from "next/navigation";

import { SupportView } from "@/components/support-view";
import { isDepartmentEnabled } from "@/lib/departments";
import {
  getAccounts,
  getContacts,
  getMembers,
  getProduct,
  getProjects,
  getTickets,
  getWorkspace,
} from "@/lib/data";

export default async function ProductSupportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const product = await getProduct(ws.id, id);
  if (!product) notFound();
  if (!isDepartmentEnabled(product.enabledDepartments, "support")) notFound();

  const [tickets, accounts, contacts, members, products] = await Promise.all([
    getTickets(ws.id, id),
    getAccounts(ws.id),
    getContacts(ws.id),
    getMembers(ws.id),
    getProjects(ws.id),
  ]);

  return (
    <SupportView
      heading={`${product.name} · Support`}
      scopeProductId={id}
      products={products}
      members={members}
      accounts={accounts}
      contacts={contacts}
      initialTickets={tickets}
    />
  );
}
