import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreateActivity, apiListActivities } from "@/lib/api/dept-ops";
import { assertSales } from "@/lib/api/scope";

export const GET = withApiAuth(async (req, auth) => {
  assertSales(auth);
  const sp = new URL(req.url).searchParams;
  const rows = await apiListActivities(auth.workspaceId, {
    dealId: sp.get("deal"),
    accountId: sp.get("account"),
  });
  return ok({ data: rows, count: rows.length });
});

export const POST = withApiAuth(async (req, auth) => {
  assertSales(auth);
  const body = await readJson<Parameters<typeof apiCreateActivity>[2]>(req);
  const id = await apiCreateActivity(auth.workspaceId, auth.userId, body);
  return ok({ data: { id } }, 201);
});
