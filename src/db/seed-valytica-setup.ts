import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq } from "drizzle-orm";

import { db, schema } from "./index";

/**
 * Valytica product hygiene:
 *   - Set the project owner to Aparna (Business Analyst & Product Owner · Valytica)
 *   - Set the brand color to Valytica blue (#1d4ed8), per the Brand & Design
 *     System doc, replacing the default indigo.
 *
 * Idempotent. Run: npm run db:seed-valytica-setup
 */

const OWNER_EMAIL = "aparna@gnanalytica.com";
const BRAND_BLUE = "#1d4ed8"; // Valytica gradient start (#1d4ed8 → #3b82f6)

async function main() {
  const [ws] = await db
    .select({ id: schema.workspaces.id })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.slug, "gnanalytica"))
    .limit(1);
  if (!ws) return console.log("No gnanalytica workspace.");

  const [owner] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, OWNER_EMAIL))
    .limit(1);
  if (!owner) return console.log(`No user for ${OWNER_EMAIL}.`);

  const res = await db
    .update(schema.projects)
    .set({ ownerId: owner.id, color: BRAND_BLUE })
    .where(and(eq(schema.projects.workspaceId, ws.id), eq(schema.projects.name, "Valytica")))
    .returning({ id: schema.projects.id });

  if (res.length === 0) return console.log("No Valytica project.");
  console.log(`Valytica: owner → Aparna, color → ${BRAND_BLUE}.`);
  console.log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
