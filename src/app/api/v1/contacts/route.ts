import { contactDto } from "@/lib/api/dto";
import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreateContact } from "@/lib/api/crm-ops";
import { getContacts } from "@/lib/data";

export const GET = withApiAuth(async (_req, auth) => {
  const rows = await getContacts(auth.workspaceId);
  return ok({ data: rows.map(contactDto), count: rows.length });
});

export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<Parameters<typeof apiCreateContact>[2]>(req);
  const id = await apiCreateContact(auth.workspaceId, auth.userId, body);
  const row = (await getContacts(auth.workspaceId)).find((c) => c.id === id);
  return ok({ data: row ? contactDto(row) : { id } }, 201);
});
