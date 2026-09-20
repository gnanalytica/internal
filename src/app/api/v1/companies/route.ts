import { and, asc, eq, ilike, or } from "drizzle-orm";

import { db } from "@/db";
import { crmAccounts } from "@/db/schema";
import { ok, withApiAuth } from "@/lib/api/http";
import { SHEET_SOURCE } from "@/lib/sheet-crm/projection";

/** Companies from the lead sheet. `?q=` matches name, city, state, website or company id. */
export const GET = withApiAuth(async (req, auth) => {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  const like = q ? `%${q}%` : null;
  const rows = await db
    .select()
    .from(crmAccounts)
    .where(
      and(
        eq(crmAccounts.workspaceId, auth.workspaceId),
        eq(crmAccounts.externalSource, SHEET_SOURCE),
        like ? or(ilike(crmAccounts.name, like), ilike(crmAccounts.city, like), ilike(crmAccounts.state, like), ilike(crmAccounts.website, like), ilike(crmAccounts.externalId, like)) : undefined,
      ),
    )
    .orderBy(asc(crmAccounts.name))
    .limit(500);
  return ok({
    data: rows.map((a) => ({
      id: a.id,
      companyId: a.externalId,
      name: a.name,
      website: a.website,
      city: a.city,
      state: a.state,
      constitution: a.constitution,
      ibbiEntityRegNo: a.ibbiEntityRegNo,
      pnbCategory: a.pnbCategory,
      researchConfidence: a.researchConfidence,
      outreachStatus: a.outreachStatus,
      lastContactedAt: a.lastContactedAt,
    })),
    count: rows.length,
  });
});
