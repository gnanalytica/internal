import { config } from "dotenv";

config({ path: ".env.local" });

import { eq } from "drizzle-orm";

import { db, schema } from "./index";

/**
 * Opt Valytica (key VAL) into the new surface set. Idempotent — re-running sets
 * the same array. Other products keep enabledDepartments = null (legacy set).
 * Run: npx tsx --env-file=.env.local src/db/valytica-enable-surfaces.ts
 */
async function main() {
  const res = await db
    .update(schema.projects)
    .set({ enabledDepartments: ["strategy", "roadmap", "growth", "analytics"] })
    .where(eq(schema.projects.key, "VAL"))
    .returning({ key: schema.projects.key });
  console.log(res.length ? `✓ enabled surfaces for ${res[0].key}` : "✗ VAL project not found");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
