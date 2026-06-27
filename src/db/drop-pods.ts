/**
 * Drop the Teams/Pods concept: remove issues.team_id and projects.owner_team_id,
 * add projects.owner_id (→ users), and drop the team_members + teams tables.
 * Idempotent. neon-http has no transactions, so this runs as guarded steps.
 */
import { sql } from "drizzle-orm";

import { db } from "./index";

async function run(label: string, statement: string) {
  await db.execute(sql.raw(statement));
  console.log(`✓ ${label}`);
}

async function main() {
  await run(
    "issues.team_id dropped",
    `ALTER TABLE "issues" DROP COLUMN IF EXISTS "team_id";`,
  );
  await run(
    "projects.owner_team_id dropped",
    `ALTER TABLE "projects" DROP COLUMN IF EXISTS "owner_team_id";`,
  );
  await run(
    "projects.owner_id added",
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'owner_id'
      ) THEN
        ALTER TABLE "projects" ADD COLUMN "owner_id" uuid
          REFERENCES "users"("id") ON DELETE set null;
      END IF;
    END $$;`,
  );
  await run("team_members dropped", `DROP TABLE IF EXISTS "team_members";`);
  await run("teams dropped", `DROP TABLE IF EXISTS "teams";`);

  console.log("\nDone.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
