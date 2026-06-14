import { expenseDto } from "@/lib/api/dto";
import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreateExpense } from "@/lib/api/crm-ops";
import { getExpenses } from "@/lib/data";

export const GET = withApiAuth(async (req, auth) => {
  const product = new URL(req.url).searchParams.get("product") ?? undefined;
  const rows = await getExpenses(auth.workspaceId, product);
  return ok({ data: rows.map(expenseDto), count: rows.length });
});

export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<Parameters<typeof apiCreateExpense>[2]>(req);
  const id = await apiCreateExpense(auth.workspaceId, auth.userId, body);
  const row = (await getExpenses(auth.workspaceId)).find((e) => e.id === id);
  return ok({ data: row ? expenseDto(row) : { id } }, 201);
});
