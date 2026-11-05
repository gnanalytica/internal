import { config } from "dotenv";
config({ path: ".env.local" });
import { sql } from "drizzle-orm";
import { db } from "./index";

/**
 * Idempotent: add deals.prospect_ref and its unique (workspace_id, prospect_ref)
 * index, which the prospects → deals sync (src/lib/prospects/deals.ts) keys on.
 * Same change as `pnpm db:push` would make from schema.ts; safe to run twice.
 *
 *     pnpm tsx --env-file=.env.local src/db/add-deal-prospect-ref.ts
 */
async function main() {
  await db.execute(sql`alter table deals add column if not exists prospect_ref text`);
  console.log("deals.prospect_ref  added");
  await db.execute(
    sql`create unique index if not exists deals_prospect_ref_idx on deals (workspace_id, prospect_ref)`,
  );
  console.log("deals_prospect_ref_idx  created");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
