import { config } from "dotenv";
config({ path: ".env.local" });
import { sql } from "drizzle-orm";
import { db } from "./index";

/** Idempotent: the campaign brief link. */
async function main() {
  await db.execute(
    sql`alter table campaigns add column if not exists page_id uuid references pages(id) on delete set null`,
  );
  console.log("campaigns.page_id added");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
