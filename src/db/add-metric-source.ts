import { config } from "dotenv";
config({ path: ".env.local" });
import { sql } from "drizzle-orm";
import { db } from "./index";

/**
 * Idempotent: add metrics.source and metrics.area, which the Analytics
 * scorecard reads (src/lib/scorecard.ts). Same change as `pnpm db:push` would
 * make from schema.ts; safe to run twice. Existing metrics become manual
 * Product metrics until they are placed (see src/db/seed-scorecard.ts).
 *
 *     pnpm tsx --env-file=.env.local src/db/add-metric-source.ts
 */
async function main() {
  await db.execute(sql`alter table metrics add column if not exists source text not null default 'manual'`);
  console.log("metrics.source  added");
  await db.execute(sql`alter table metrics add column if not exists area text not null default 'product'`);
  console.log("metrics.area  added");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
