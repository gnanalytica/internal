import { config } from "dotenv";
config({ path: ".env.local" });
import { sql } from "drizzle-orm";
import { db } from "./index";

/**
 * Idempotent: add feedback.source_ref and its unique (workspace_id, source_ref)
 * index, which "Send to Product" (src/lib/send-to-product-actions.ts) keys on
 * so the same remark can't be sent twice. Same change as `pnpm db:push` would
 * make from schema.ts; safe to run twice.
 *
 *     pnpm tsx --env-file=.env.local src/db/add-feedback-source-ref.ts
 */
async function main() {
  await db.execute(sql`alter table feedback add column if not exists source_ref text`);
  console.log("feedback.source_ref  added");
  await db.execute(
    sql`create unique index if not exists feedback_source_ref_idx on feedback (workspace_id, source_ref) where source_ref is not null`,
  );
  console.log("feedback_source_ref_idx  created");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
