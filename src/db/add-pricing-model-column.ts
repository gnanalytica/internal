import { config } from "dotenv";

config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

/**
 * Idempotent: add the `pricing_model` jsonb column to `projects`.
 * Neon HTTP — plain SQL, no transaction. Safe to re-run.
 * Run: npx tsx --env-file=.env.local src/db/add-pricing-model-column.ts
 */
async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS pricing_model jsonb`;
  const [{ exists }] = await sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'projects' AND column_name = 'pricing_model'
    ) AS exists`;
  console.log(exists ? "✓ pricing_model present" : "✗ pricing_model missing");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
