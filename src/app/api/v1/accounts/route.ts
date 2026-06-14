import { accountDto } from "@/lib/api/dto";
import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreateAccount } from "@/lib/api/crm-ops";
import { getAccounts } from "@/lib/data";

export const GET = withApiAuth(async (_req, auth) => {
  const rows = await getAccounts(auth.workspaceId);
  return ok({ data: rows.map(accountDto), count: rows.length });
});

export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<Parameters<typeof apiCreateAccount>[2]>(req);
  const id = await apiCreateAccount(auth.workspaceId, auth.userId, body);
  const row = (await getAccounts(auth.workspaceId)).find((a) => a.id === id);
  return ok({ data: row ? accountDto(row) : { id } }, 201);
});
