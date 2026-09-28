import { describe, expect, it } from "vitest";

import { financeSummary } from "./finance-summary";

const inv = (status: string, amount: number, entity = "India") => ({ status, amount, entity });
const exp = (category: string, amount: number, status = "paid", entity = "India") => ({ category, amount, status, entity });

describe("financeSummary", () => {
  it("splits invoices into issued, paid, outstanding and draft", () => {
    const s = financeSummary([inv("paid", 50_000), inv("sent", 20_000), inv("overdue", 5_000), inv("draft", 9_000)], [], "INR");
    expect(s).toMatchObject({ issued: 75_000, paid: 50_000, outstanding: 25_000, overdue: 5_000, draft: 9_000, invoiceCount: 4 });
  });

  it("nets received revenue against all spend, and groups spend by category, largest first", () => {
    const s = financeSummary(
      [inv("paid", 100_000), inv("sent", 40_000)],
      [exp("tooling", 10_000), exp("infra", 25_000, "planned"), exp("tooling", 5_000)],
      "INR",
    );
    expect(s.expenses).toBe(40_000);
    expect(s.expensesPaid).toBe(15_000);
    expect(s.net).toBe(60_000);
    expect(s.byCategory).toEqual([
      { id: "infra", amount: 25_000 },
      { id: "tooling", amount: 15_000 },
    ]);
  });

  it("converts each row from its entity's currency into the display currency", () => {
    // Global rows are USD (₹83), Netherlands rows are EUR (₹90).
    const s = financeSummary([inv("paid", 100, "Global"), inv("paid", 10, "Netherlands")], [exp("other", 1, "paid", "Global")], "INR");
    expect(s.paid).toBe(8_300 + 900);
    expect(s.expenses).toBe(83);
    const usd = financeSummary([inv("paid", 8_300, "India")], [], "USD");
    expect(usd.paid).toBe(100);
    expect(usd.currency).toBe("USD");
  });

  it("treats a missing amount and an unknown entity as zero and INR", () => {
    const s = financeSummary([{ status: "paid", amount: null, entity: "India" }, inv("paid", 500, "Mars")], [], "INR");
    expect(s.paid).toBe(500);
  });

  it("is all zeros for a project with no money yet", () => {
    const s = financeSummary([], [], "INR");
    expect(s).toMatchObject({ issued: 0, paid: 0, outstanding: 0, expenses: 0, net: 0, byCategory: [] });
  });
});
