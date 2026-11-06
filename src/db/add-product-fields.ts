import { config } from "dotenv";
config({ path: ".env.local" });
import { sql } from "drizzle-orm";
import { db } from "./index";

/**
 * Idempotent: add features.summary (one line on why a feature is on the
 * roadmap) and feedback.theme (what an item is about, so the Product ›
 * Feedback tab can group it), then backfill theme from title on rows that have
 * none. Same columns as `pnpm db:push` would add from schema.ts; safe to run
 * twice. Sequential statements, no transaction (the Neon HTTP driver has none).
 *
 *     pnpm tsx --env-file=.env.local src/db/add-product-fields.ts
 */
async function main() {
  await db.execute(sql`alter table features add column if not exists summary text`);
  console.log("features.summary  added");
  await db.execute(sql`alter table feedback add column if not exists theme text`);
  console.log("feedback.theme  added");
  await db.execute(sql`update feedback set theme = title where theme is null or btrim(theme) = ''`);
  console.log("feedback.theme  backfilled from title");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
