import { FinanceView } from "@/components/finance-view";
import {
  getAccounts,
  getExpenses,
  getInvoices,
  getProjects,
  getWorkspace,
} from "@/lib/data";

export default async function FinancePage() {
  const ws = await getWorkspace();
  const [invoices, expenses, accounts, products] = await Promise.all([
    getInvoices(ws.id),
    getExpenses(ws.id),
    getAccounts(ws.id),
    getProjects(ws.id),
  ]);

  return (
    <FinanceView
      heading="Finance · all products"
      scopeProductId={null}
      products={products}
      accounts={accounts}
      initialInvoices={invoices}
      initialExpenses={expenses}
    />
  );
}
