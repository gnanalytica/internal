/**
 * Idempotent migration: add the per-product `economics` jsonb column to
 * `projects` (the Finance department's unit-economics model). Safe to re-run.
 *
 *   npx tsx --env-file=.env.local src/db/add-economics-column.ts
 */
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS economics jsonb`;
  const [{ exists }] = await sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'projects' AND column_name = 'economics'
    ) AS exists
  `;
  console.log(exists ? "✓ projects.economics present" : "✗ column missing");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
