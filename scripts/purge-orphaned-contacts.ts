/**
 * Clean up the projected contacts left behind before the sync learned to
 * remove them (`src/lib/sheet-crm/sync.ts`).
 *
 * A contact whose `person_id` no longer names a live `sheet_rows` row is a
 * person the source of truth does not have. They still appeared in the app —
 * 52 of them on 2026-09-26, three assigned to someone.
 *
 * Two steps, in this order, because the second one cascades:
 *   1. re-point interactions/activities onto the surviving twin for every
 *      orphan that is a known merge loser (`repointMergedContacts`);
 *   2. delete the orphans.
 *
 * An orphan that still carries history after step 1 is NOT deleted — it is
 * reported. That means it is not a merge loser we know about, so there is no
 * survivor to move the calls to, and silently destroying them would be worse
 * than leaving a row to look at.
 *
 * `pnpm sheet:purge-orphan-contacts`; `--apply` writes.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "node:fs";
import { sql } from "drizzle-orm";

import { db } from "../src/db";
import { repointMergedContacts } from "../src/lib/sheet-crm/merge-projection";
import { MERGED_PAIRS } from "./merged-pairs";

const APPLY = process.argv.includes("--apply");

type Orphan = {
  id: string;
  external_id: string;
  name: string;
  owned: boolean;
  interactions: number;
  activities: number;
};

const ORPHAN_SQL = sql`
  select c.id, c.external_id, c.name,
         c.owner_id is not null as owned,
         (select count(*) from interactions i where i.contact_id = c.id)::int as interactions,
         (select count(*) from crm_activities a where a.contact_id = c.id)::int as activities
  from crm_contacts c
  where c.external_source = 'valytica-sheet'
    and not exists (
      select 1 from sheet_rows r
      where r.tab = 'people' and r.deleted_at is null
        and r.data->>'person_id' = c.external_id)
  order by c.external_id`;

async function orphans(): Promise<Orphan[]> {
  const r = await db.execute(ORPHAN_SQL);
  return ((r as unknown as { rows: Orphan[] }).rows ?? []);
}

async function main() {
  const before = await orphans();
  console.log(`${before.length} orphaned contact(s)`);
  const withHistory = before.filter((o) => o.interactions > 0 || o.activities > 0 || o.owned);
  for (const o of withHistory) {
    console.log(
      `   ${o.external_id.padEnd(8)} ${o.name.slice(0, 32).padEnd(34)}` +
        ` interactions=${o.interactions} activities=${o.activities} owned=${o.owned}`,
    );
  }
  if (!before.length) return;

  if (!APPLY) {
    const known = new Set(MERGED_PAIRS.map(([, drop]) => drop));
    const unknown = withHistory.filter((o) => !known.has(o.external_id));
    console.log(`\n${withHistory.length} carry history; ${withHistory.length - unknown.length} are known merge losers`);
    if (unknown.length) {
      console.log(`   would KEEP (history, no known survivor): ${unknown.map((o) => o.external_id).join(", ")}`);
    }
    console.log("\nDry run. Re-run with --apply.");
    return;
  }

  mkdirSync("tmp", { recursive: true });
  const snapshot = `tmp/orphaned-contacts-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(snapshot, JSON.stringify(before, null, 2));
  console.log(`snapshot: ${snapshot}`);

  const moved = await repointMergedContacts(
    MERGED_PAIRS.map(([keep, drop]) => ({ keep, drop })),
  );
  console.log(
    `re-pointed ${moved.interactions} interaction(s), ${moved.activities} activity(ies),` +
      ` carried ${moved.ownersCarried} owner(s)`,
  );

  // Re-read: anything still holding history has no survivor to give it to.
  const after = await orphans();
  const keep = after.filter((o) => o.interactions > 0 || o.activities > 0);
  const remove = after.filter((o) => o.interactions === 0 && o.activities === 0);

  if (remove.length) {
    const r = await db.execute(sql`
      delete from crm_contacts
      where id in (${sql.join(remove.map((o) => sql`${o.id}`), sql`, `)})
      returning id`);
    console.log(`deleted ${((r as unknown as { rows: unknown[] }).rows ?? []).length} orphan(s)`);
  }
  if (keep.length) {
    console.log(`\nKEPT ${keep.length} with history and no known survivor — decide these by hand:`);
    for (const o of keep) {
      console.log(`   ${o.external_id} ${o.name} (interactions=${o.interactions} activities=${o.activities})`);
    }
  }

  const left = await orphans();
  console.log(`\norphans now: ${left.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
