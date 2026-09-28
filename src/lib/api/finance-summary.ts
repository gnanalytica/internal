/**
 * The totals on a project's Finance page. Each invoice and expense is stored in
 * its entity's currency (India INR, Netherlands EUR, Global USD); the web shows
 * every total converted into the product's own currency, at the static rates in
 * `src/lib/currency.ts`. Pure, so the arithmetic is unit-tested.
 */
import { convert, entityCurrency } from "@/lib/currency";

type Money = { amount: number | null; entity: string };

export type FinanceSummary = {
  currency: string;
  /** Everything billed: sent, paid and overdue invoices (drafts are not issued). */
  issued: number;
  paid: number;
  /** Billed and not yet paid: sent + overdue. */
  outstanding: number;
  overdue: number;
  draft: number;
  expenses: number;
  expensesPaid: number;
  /** Revenue actually received minus all spend — the web's "Net". */
  net: number;
  invoiceCount: number;
  expenseCount: number;
  byCategory: { id: string; amount: number }[];
};

export function financeSummary(
  invoices: (Money & { status: string })[],
  expenses: (Money & { status: string; category: string })[],
  currency: string,
): FinanceSummary {
  const to = (m: Money) => convert(m.amount ?? 0, entityCurrency(m.entity), currency);
  const sum = <T extends Money>(rows: T[], keep: (r: T) => boolean) => rows.filter(keep).reduce((s, r) => s + to(r), 0);

  const paid = sum(invoices, (i) => i.status === "paid");
  const overdue = sum(invoices, (i) => i.status === "overdue");
  const sent = sum(invoices, (i) => i.status === "sent");
  const spend = sum(expenses, () => true);

  const byCategory = new Map<string, number>();
  for (const e of expenses) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + to(e));

  const round = Math.round;
  return {
    currency,
    issued: round(paid + overdue + sent),
    paid: round(paid),
    outstanding: round(sent + overdue),
    overdue: round(overdue),
    draft: round(sum(invoices, (i) => i.status === "draft")),
    expenses: round(spend),
    expensesPaid: round(sum(expenses, (e) => e.status === "paid")),
    net: round(paid - spend),
    invoiceCount: invoices.length,
    expenseCount: expenses.length,
    byCategory: [...byCategory.entries()]
      .map(([id, amount]) => ({ id, amount: round(amount) }))
      .sort((a, b) => b.amount - a.amount),
  };
}
