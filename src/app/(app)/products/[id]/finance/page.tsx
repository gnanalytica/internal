import { notFound } from "next/navigation";

import { FinanceView } from "@/components/finance-view";
import {
  getAccounts,
  getExpenses,
  getInvoices,
  getProduct,
  getProjects,
  getWorkspace,
} from "@/lib/data";

export default async function ProductFinancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const product = await getProduct(ws.id, id);
  if (!product) notFound();

  const [invoices, expenses, accounts, products] = await Promise.all([
    getInvoices(ws.id, id),
    getExpenses(ws.id, id),
    getAccounts(ws.id),
    getProjects(ws.id),
  ]);

  return (
    <FinanceView
      heading={`${product.name} · Finance`}
      scopeProductId={id}
      products={products}
      accounts={accounts}
      initialInvoices={invoices}
      initialExpenses={expenses}
    />
  );
}
