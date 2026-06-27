import { config } from "dotenv";

config({ path: ".env.local" });

import { sql } from "drizzle-orm";

import { db } from "./index";

/**
 * Wipe ALL workspace data (every table) while keeping the schema. Does NOT seed.
 * Auth is handled by Neon Auth separately, so logins keep working — users are
 * re-provisioned and sent to onboarding on next visit.
 *
 * Run: npm run db:reset
 */
const TABLES = [
  "workspaces",
  "users",
  "workspace_members",
  "projects",
  "labels",
  "cycles",
  "databases",
  "database_fields",
  "database_rows",
  "issues",
  "issue_labels",
  "issue_relations",
  "pages",
  "issue_page_links",
  "comments",
  "comment_reactions",
  "activity",
  "references",
  "notifications",
  "attachments",
  "favorites",
  "project_status_updates",
  "api_keys",
  "webhooks",
  "saved_views",
];

async function main() {
  const list = TABLES.map((t) => `"${t}"`).join(", ");
  console.log(`Truncating ${TABLES.length} tables…`);
  await db.execute(sql.raw(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`));
  console.log("Done. All workspace data removed (schema intact).");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
