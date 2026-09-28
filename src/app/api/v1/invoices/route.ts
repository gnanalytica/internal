import { invoiceDto } from "@/lib/api/dto";
import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreateInvoice } from "@/lib/api/crm-ops";
import { getInvoices } from "@/lib/data";
import { assertFinance, canSeeFinance } from "@/lib/api/scope";

export const GET = withApiAuth(async (req, auth) => {
  const project = new URL(req.url).searchParams.get("project") ?? undefined;
  const rows = (await getInvoices(auth.workspaceId, project)).filter((r) => canSeeFinance(auth.scope, r.projectId));
  return ok({ data: rows.map(invoiceDto), count: rows.length });
});

export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<Parameters<typeof apiCreateInvoice>[2]>(req);
  assertFinance(auth, (body as { projectId?: string | null }).projectId);
  const id = await apiCreateInvoice(auth.workspaceId, auth.userId, body);
  const row = (await getInvoices(auth.workspaceId)).find((i) => i.id === id);
  return ok({ data: row ? invoiceDto(row) : { id } }, 201);
});
