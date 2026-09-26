import { sql } from "drizzle-orm";

import { db } from "@/db";

import { SHEET_SOURCE } from "./projection";

/**
 * Move a merged duplicate's mirror-side history onto the surviving contact.
 *
 * `interactions.contact_id` and `crm_activities.contact_id` are both
 * `on delete cascade`, so deleting the loser's projected contact — which is
 * what the sync now does once its sheet row disappears — takes the logged
 * conversations with it. On the 2026-09-26 merge set that was 12 interactions
 * and 4 activities across four people, all of them belonging to someone who
 * still exists under a different person_id.
 *
 * So this runs BEFORE the row goes. Re-pointing is also the honest answer
 * rather than a nicety: the two rows were always one person, and the calls were
 * made to that person.
 *
 * Idempotent — a second run finds nothing still pointing at the loser.
 */
export async function repointMergedContacts(
  pairs: { keep: string; drop: string }[],
): Promise<{ interactions: number; activities: number; ownersCarried: number }> {
  if (pairs.length === 0) return { interactions: 0, activities: 0, ownersCarried: 0 };

  // A pair is matched inside one workspace: external_id is unique per
  // (workspace, source), so joining without the workspace would re-point one
  // tenant's history onto another's contact if the two ever shared a sheet.
  const values = sql.join(
    pairs.map((p) => sql`(${p.keep}, ${p.drop})`),
    sql`, `,
  );

  const pairCte = sql`
    with pair(keep_ext, drop_ext) as (values ${values}),
    m as (
      select k.id as keep_id, d.id as drop_id, k.workspace_id
      from pair
      join crm_contacts k
        on k.external_source = ${SHEET_SOURCE} and k.external_id = pair.keep_ext
      join crm_contacts d
        on d.external_source = ${SHEET_SOURCE} and d.external_id = pair.drop_ext
       and d.workspace_id = k.workspace_id
    )`;

  const moved = await db.execute(sql`
    ${pairCte}
    update interactions i set contact_id = m.keep_id
    from m where i.contact_id = m.drop_id
    returning i.id`);

  const activities = await db.execute(sql`
    ${pairCte}
    update crm_activities a set contact_id = m.keep_id
    from m where a.contact_id = m.drop_id
    returning a.id`);

  // An owner assigned to the row that is going should not be lost, but must
  // never overwrite one the survivor already has.
  const owners = await db.execute(sql`
    ${pairCte}
    update crm_contacts k set owner_id = d.owner_id
    from m join crm_contacts d on d.id = m.drop_id
    where k.id = m.keep_id and k.owner_id is null and d.owner_id is not null
    returning k.id`);

  const count = (r: unknown) => ((r as { rows?: unknown[] }).rows ?? []).length;
  return {
    interactions: count(moved),
    activities: count(activities),
    ownersCarried: count(owners),
  };
}
