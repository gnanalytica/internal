import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { crmAccounts } from "@/db/schema";
import { notFound, ok, withApiAuth } from "@/lib/api/http";
import { interactionDto } from "@/lib/api/people-ops";
import { SHEET_SOURCE } from "@/lib/sheet-crm/projection";
import { getCompanyView } from "@/lib/sheet-crm/queries";

/** One company by account id or sheet company id (C####). */
export const GET = withApiAuth<{ id: string }>(async (_req, auth, { id }) => {
  let accountId = id;
  if (/^C\d{4}$/i.test(id)) {
    const [a] = await db.select({ id: crmAccounts.id }).from(crmAccounts).where(and(eq(crmAccounts.workspaceId, auth.workspaceId), eq(crmAccounts.externalSource, SHEET_SOURCE), eq(crmAccounts.externalId, id.toUpperCase()))).limit(1);
    if (!a) return notFound("Company");
    accountId = a.id;
  }
  const v = await getCompanyView(auth.workspaceId, accountId);
  if (!v) return notFound("Company");
  return ok({
    data: {
      id: v.account.id,
      companyId: v.account.externalId,
      name: v.account.name,
      website: v.account.website,
      city: v.account.city,
      state: v.account.state,
      outreachStatus: v.account.outreachStatus,
      sheet: v.record,
      people: v.people,
      excluded: v.excluded ? { name: v.excluded.name, action: v.excluded.action } : null,
      interactions: v.interactions.map(interactionDto),
    },
  });
});
