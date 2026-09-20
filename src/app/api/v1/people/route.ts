import { ok, withApiAuth } from "@/lib/api/http";
import { personDto } from "@/lib/api/people-ops";
import { getProspects, type PeopleFilter } from "@/lib/sheet-crm/queries";

/**
 * People from the Valytica lead sheet, with the outreach state Internal holds.
 * `?q=` searches name, person id, IBBI, email, phone, city, firm. Exact
 * filters: state, priority, band, status (outreach), persona=valuer|institutional,
 * hasPhone=1, hasEmail=1, researched=1. `?limit=` (≤500) and `?offset=`.
 */
export const GET = withApiAuth(async (req, auth) => {
  const sp = new URL(req.url).searchParams;
  const f: PeopleFilter = {
    q: sp.get("q") ?? undefined,
    state: sp.get("state") ?? undefined,
    city: sp.get("city") ?? undefined,
    priority: sp.get("priority") ?? undefined,
    band: sp.get("band") ?? undefined,
    status: sp.get("status") ?? undefined,
    rvo: sp.get("rvo") ?? undefined,
    persona: (sp.get("persona") as PeopleFilter["persona"]) ?? undefined,
    hasPhone: sp.get("hasPhone") === "1" || undefined,
    hasEmail: sp.get("hasEmail") === "1" || undefined,
    researched: sp.get("researched") === "1" || undefined,
    limit: Number(sp.get("limit") ?? 100) || 100,
    offset: Number(sp.get("offset") ?? 0) || 0,
  };
  const { rows, total } = await getProspects(auth.workspaceId, f);
  return ok({ data: rows.map(personDto), count: rows.length, total });
});
