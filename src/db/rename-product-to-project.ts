/**
 * Data-preserving rename of `product_id` → `project_id` across the department
 * tables (and their indexes). Idempotent: re-running is a no-op once applied.
 *
 * neon-http has no interactive transactions, so this runs as a sequence of
 * independent, guarded statements (see memory: neon-http-no-transactions).
 */
import { sql } from "drizzle-orm";

import { db } from "./index";

const TABLES = [
  "deals",
  "crm_activities",
  "campaigns",
  "content_items",
  "invoices",
  "expenses",
  "tickets",
  "features",
] as const;

// Tables that also carry a `<table>_product_idx` index to rename.
const INDEXED = [
  "deals",
  "campaigns",
  "content_items",
  "invoices",
  "expenses",
  "tickets",
  "features",
] as const;

async function main() {
  for (const t of TABLES) {
    await db.execute(
      sql.raw(`DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = '${t}' AND column_name = 'product_id'
        ) THEN
          ALTER TABLE "${t}" RENAME COLUMN "product_id" TO "project_id";
        END IF;
      END $$;`),
    );
    console.log(`✓ ${t}.product_id → project_id`);
  }

  for (const t of INDEXED) {
    await db.execute(
      sql.raw(
        `ALTER INDEX IF EXISTS "${t}_product_idx" RENAME TO "${t}_project_idx";`,
      ),
    );
    console.log(`✓ ${t}_product_idx → ${t}_project_idx`);
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
