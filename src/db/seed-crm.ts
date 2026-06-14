import { config } from "dotenv";

config({ path: ".env.local" });

import { eq } from "drizzle-orm";

import { db, schema } from "./index";
import { seedCrm } from "./seed-crm-data";

/**
 * Add the Sales / Marketing / CRM layer to an already-provisioned Gnanalytica
 * workspace. Idempotent — safe to run on the live hub. For a fresh DB use
 * `npm run db:seed-org`, which provisions this layer too.
 *
 * Run: npm run db:seed-crm
 */
async function main() {
  const [ws] = await db
    .select({ id: schema.workspaces.id })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.slug, "gnanalytica"))
    .limit(1);
  if (!ws) {
    console.log("No Gnanalytica workspace found — run `npm run db:seed-org` first.");
    return;
  }

  const [owner] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, "sandeep@gnanalytica.com"))
    .limit(1);
  if (!owner) {
    console.log("No owner user found — run `npm run db:seed-org` first.");
    return;
  }

  console.log("Provisioning Sales / Marketing / CRM…");
  await seedCrm(ws, owner);
  console.log("Done — CRM layer provisioned.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
