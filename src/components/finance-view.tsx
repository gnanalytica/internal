"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Plus } from "lucide-react";

import { AreaChart, ChartCard, ColumnChart, type Slice } from "@/components/charts";
import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createExpense,
  createInvoice,
  deleteExpense,
  deleteInvoice,
  updateExpense,
  updateInvoice,
} from "@/lib/actions";
import {
  ENTITIES,
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
  INVOICE_STATUSES,
} from "@/lib/departments";
import { dateInputValue, formatMoney } from "@/lib/matrix-format";
import type {
  CrmAccount,
  ExpenseWithRelations,
  InvoiceWithRelations,
  Project,
} from "@/lib/types";

const fieldCls =
  "h-8 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40";

export function FinanceView({
  heading,
  scopeProductId,
  accounts,
  initialInvoices,
  initialExpenses,
}: {
  heading: string;
  scopeProductId: string | null;
  products: Project[];
  accounts: CrmAccount[];
  initialInvoices: InvoiceWithRelations[];
  initialExpenses: ExpenseWithRelations[];
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const refresh = () => router.refresh();

  const revenue = initialInvoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + (i.amount ?? 0), 0);
  const outstanding = initialInvoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + (i.amount ?? 0), 0);
  const spend = initialExpenses.reduce((s, e) => s + (e.amount ?? 0), 0);

  const monthShort = (k: string) => {
    const [y, m] = k.split("-");
    return new Date(Date.UTC(+y, +m - 1, 1)).toLocaleDateString(undefined, {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    });
  };
  const revByMonth = new Map<string, number>();
  for (const i of initialInvoices) {
    if (i.status !== "paid" || !i.issueDate) continue;
    const k = new Date(i.issueDate).toISOString().slice(0, 7);
    revByMonth.set(k, (revByMonth.get(k) ?? 0) + (i.amount ?? 0));
  }
  const revSeries = [...revByMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => ({ label: monthShort(k), value: v }));

  const expByCategory: Slice[] = EXPENSE_CATEGORIES.map((c) => ({
    label: c.label,
    value: initialExpenses
      .filter((e) => e.category === c.id)
      .reduce((s, e) => s + (e.amount ?? 0), 0),
    color: c.color,
  }));

  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[{ label: heading }]}
        actions={
          <span className="text-xs text-muted-foreground">
            Revenue {formatMoney(revenue)} · Outstanding {formatMoney(outstanding)} · Expenses{" "}
            {formatMoney(spend)} · Net {formatMoney(revenue - spend)}
          </span>
        }
      />

      <Tabs defaultValue="invoices" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-4 mt-2 self-start">
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="min-h-0 flex-1 overflow-auto p-4">
          {revSeries.length > 0 && (
            <ChartCard
              title="Revenue (paid invoices)"
              hint={formatMoney(revenue)}
              className="mb-4"
            >
              <AreaChart data={revSeries} color="#10b981" format={(n) => formatMoney(n)} />
            </ChartCard>
          )}
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold">Invoices</h2>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto gap-1.5"
              onClick={() => start(async () => { await createInvoice({ productId: scopeProductId }); refresh(); })}
            >
              <Plus className="size-4" /> New invoice
            </Button>
          </div>
          <div className="space-y-1.5">
            {initialInvoices.map((inv) => (
              <InvoiceRow
                key={inv.id}
                invoice={inv}
                accounts={accounts}
                showProduct={!scopeProductId}
                onChanged={refresh}
              />
            ))}
            {initialInvoices.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">No invoices yet.</div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="expenses" className="min-h-0 flex-1 overflow-auto p-4">
          {spend > 0 && (
            <ChartCard title="Expenses by category" hint={formatMoney(spend)} className="mb-4">
              <ColumnChart data={expByCategory} format={(n) => formatMoney(n)} />
            </ChartCard>
          )}
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold">Expenses</h2>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto gap-1.5"
              onClick={() => start(async () => { await createExpense({ productId: scopeProductId }); refresh(); })}
            >
              <Plus className="size-4" /> New expense
            </Button>
          </div>
          <div className="space-y-1.5">
            {initialExpenses.map((e) => (
              <ExpenseRow key={e.id} expense={e} showProduct={!scopeProductId} onChanged={refresh} />
            ))}
            {initialExpenses.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">No expenses yet.</div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProductTag({ product }: { product: Project | null }) {
  if (!product) return null;
  return (
    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
      <span className="size-2 rounded-full" style={{ backgroundColor: product.color }} />
      {product.name}
    </span>
  );
}

function InvoiceRow({
  invoice,
  accounts,
  showProduct,
  onChanged,
}: {
  invoice: InvoiceWithRelations;
  accounts: CrmAccount[];
  showProduct: boolean;
  onChanged: () => void;
}) {
  const [, start] = useTransition();
  const upd = (patch: Parameters<typeof updateInvoice>[1]) =>
    start(async () => { await updateInvoice(invoice.id, patch); onChanged(); });
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-2">
      <input
        defaultValue={invoice.number ?? ""}
        placeholder="INV-001"
        onBlur={(e) => e.target.value !== (invoice.number ?? "") && upd({ number: e.target.value || null })}
        className={fieldCls + " w-28 font-mono"}
      />
      {showProduct && <ProductTag product={invoice.product} />}
      <select
        defaultValue={invoice.accountId ?? ""}
        onChange={(e) => upd({ accountId: e.target.value || null })}
        className={fieldCls + " min-w-32 flex-1"}
      >
        <option value="">No account</option>
        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <input
        type="number"
        defaultValue={invoice.amount}
        onBlur={(e) => Number(e.target.value) !== invoice.amount && upd({ amount: Number(e.target.value) || 0 })}
        className={fieldCls + " w-24"}
        placeholder="Amount"
      />
      <select defaultValue={invoice.status} onChange={(e) => upd({ status: e.target.value })} className={fieldCls}>
        {INVOICE_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <input
        type="date"
        defaultValue={dateInputValue(invoice.dueDate)}
        onChange={(e) => upd({ dueDate: e.target.value || null })}
        className={fieldCls}
        title="Due date"
      />
      <select defaultValue={invoice.entity} onChange={(e) => upd({ entity: e.target.value })} className={fieldCls}>
        {ENTITIES.map((en) => <option key={en.id} value={en.id}>{en.label}</option>)}
      </select>
      <button
        onClick={() => start(async () => { await deleteInvoice(invoice.id); onChanged(); })}
        className="text-xs text-muted-foreground hover:text-destructive"
      >
        Delete
      </button>
    </div>
  );
}

function ExpenseRow({
  expense,
  showProduct,
  onChanged,
}: {
  expense: ExpenseWithRelations;
  showProduct: boolean;
  onChanged: () => void;
}) {
  const [, start] = useTransition();
  const upd = (patch: Parameters<typeof updateExpense>[1]) =>
    start(async () => { await updateExpense(expense.id, patch); onChanged(); });
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-2">
      <input
        defaultValue={expense.vendor ?? ""}
        placeholder="Vendor"
        onBlur={(e) => e.target.value !== (expense.vendor ?? "") && upd({ vendor: e.target.value || null })}
        className={fieldCls + " min-w-32 flex-1 font-medium"}
      />
      {showProduct && <ProductTag product={expense.product} />}
      <select defaultValue={expense.category} onChange={(e) => upd({ category: e.target.value })} className={fieldCls}>
        {EXPENSE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <input
        type="number"
        defaultValue={expense.amount}
        onBlur={(e) => Number(e.target.value) !== expense.amount && upd({ amount: Number(e.target.value) || 0 })}
        className={fieldCls + " w-24"}
        placeholder="Amount"
      />
      <select defaultValue={expense.status} onChange={(e) => upd({ status: e.target.value })} className={fieldCls}>
        {EXPENSE_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <input
        type="date"
        defaultValue={dateInputValue(expense.spentDate)}
        onChange={(e) => upd({ spentDate: e.target.value || null })}
        className={fieldCls}
        title="Date"
      />
      <select defaultValue={expense.entity} onChange={(e) => upd({ entity: e.target.value })} className={fieldCls}>
        {ENTITIES.map((en) => <option key={en.id} value={en.id}>{en.label}</option>)}
      </select>
      <button
        onClick={() => start(async () => { await deleteExpense(expense.id); onChanged(); })}
        className="text-xs text-muted-foreground hover:text-destructive"
      >
        Delete
      </button>
    </div>
  );
}
