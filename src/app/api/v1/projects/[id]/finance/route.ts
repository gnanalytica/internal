import { departmentOn, loadProjectMeta, projectCurrency } from "@/lib/api/business-ops";
import { expenseDto, invoiceDto } from "@/lib/api/dto";
import { financeSummary } from "@/lib/api/finance-summary";
import { ok, withApiAuth } from "@/lib/api/http";
import { assertFinance, assertProjectVisible } from "@/lib/api/scope";
import { ENTITY_CURRENCY } from "@/lib/currency";
import { getExpenses, getInvoices } from "@/lib/data";

type Params = { id: string };

/**
 * One project's Finance page: its invoices and expenses, and the totals in the
 * product's own currency (`pricingModel.currency`, else INR). Row amounts are in
 * their entity's currency — `entityCurrency` maps entity to currency.
 *
 * Finance is for workspace admins and the project's owner: anyone else gets 403.
 */
export const GET = withApiAuth<Params>(async (_req, auth, { id }) => {
  assertProjectVisible(auth, id, "Project");
  const project = await loadProjectMeta(auth.workspaceId, id);
  assertFinance(auth, id);
  const [invoices, expenses] = await Promise.all([getInvoices(auth.workspaceId, id), getExpenses(auth.workspaceId, id)]);
  const currency = projectCurrency(project);
  return ok({
    data: {
      project: { id: project.id, name: project.name, key: project.key, ownerId: project.ownerId },
      enabled: departmentOn(project, "finance"),
      currency,
      entityCurrency: ENTITY_CURRENCY,
      summary: financeSummary(invoices, expenses, currency),
      invoices: invoices.map(invoiceDto),
      expenses: expenses.map(expenseDto),
    },
  });
});
