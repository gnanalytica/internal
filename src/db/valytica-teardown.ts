import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq, inArray, or, sql } from "drizzle-orm";

import { db, schema } from "./index";

/**
 * Wipe ALL content under the Valytica project (key VAL) for a clean rebuild,
 * while KEEPING the project shell itself (row, owner, brand color, department
 * config) so it stays present in the hub. Scoped strictly to projectId — never
 * touches other products, shared people/users, or the workspace.
 *
 * Neon HTTP has no transactions, so deletes run sequentially in FK-safe order:
 * children before parents, and issues explicitly (issues.projectId is ON DELETE
 * SET NULL, so a project delete would orphan them rather than remove them).
 * Loose-FK tables (references, favorites) are cleaned by captured ids.
 *
 * Idempotent: re-running on an already-clean project is a no-op. One-shot —
 * safe to delete this file (and valytica-inventory.ts) after the rebuild lands.
 *
 * Run: npx tsx --env-file=.env.local src/db/valytica-teardown.ts
 */
async function main() {
  const [val] = await db
    .select({ id: schema.projects.id, name: schema.projects.name })
    .from(schema.projects)
    .where(eq(schema.projects.key, "VAL"));
  if (!val) {
    console.log("No Valytica project (key VAL) — nothing to tear down.");
    process.exit(0);
  }
  const pid = val.id;
  console.log(`Tearing down content under "${val.name}" (${pid})\n`);

  // Capture ids of loose-FK-referenced entities before deleting them.
  const issueIds = (
    await db.select({ id: schema.issues.id }).from(schema.issues).where(eq(schema.issues.projectId, pid))
  ).map((r) => r.id);
  const pageIds = (
    await db.select({ id: schema.pages.id }).from(schema.pages).where(eq(schema.pages.projectId, pid))
  ).map((r) => r.id);

  // 1. Clean loose-FK tables (no cascade): references + favorites.
  await db.delete(schema.references).where(
    or(
      and(eq(schema.references.targetType, "project"), eq(schema.references.targetId, pid)),
      issueIds.length ? and(eq(schema.references.sourceType, "issue"), inArray(schema.references.sourceId, issueIds)) : sql`false`,
      issueIds.length ? and(eq(schema.references.targetType, "issue"), inArray(schema.references.targetId, issueIds)) : sql`false`,
      pageIds.length ? and(eq(schema.references.sourceType, "page"), inArray(schema.references.sourceId, pageIds)) : sql`false`,
      pageIds.length ? and(eq(schema.references.targetType, "page"), inArray(schema.references.targetId, pageIds)) : sql`false`,
    ),
  );
  await db.delete(schema.favorites).where(
    or(
      and(eq(schema.favorites.kind, "project"), eq(schema.favorites.targetId, pid)),
      issueIds.length ? and(eq(schema.favorites.kind, "issue"), inArray(schema.favorites.targetId, issueIds)) : sql`false`,
      pageIds.length ? and(eq(schema.favorites.kind, "page"), inArray(schema.favorites.targetId, pageIds)) : sql`false`,
    ),
  );
  console.log("· cleaned references + favorites");

  // 2. Delete issues explicitly (ON DELETE SET NULL on project) — cascades to
  //    comments, activity, attachments, labels, assignees, page-links,
  //    relations, notifications.
  await db.delete(schema.issues).where(eq(schema.issues.projectId, pid));
  console.log(`· deleted ${issueIds.length} issues (+ their comments/activity/links)`);

  // 3. Delete the rest of the project-scoped content (all ON DELETE CASCADE on
  //    projectId; their children cascade automatically).
  const tables: [string, any, any][] = [
    ["features", schema.features, schema.features.projectId],
    ["milestones", schema.milestones, schema.milestones.projectId],
    ["cycles", schema.cycles, schema.cycles.projectId],
    ["pages (docs)", schema.pages, schema.pages.projectId],
    ["campaigns", schema.campaigns, schema.campaigns.projectId],
    ["content items", schema.contentItems, schema.contentItems.projectId],
    ["deals", schema.deals, schema.deals.projectId],
    ["support tickets", schema.tickets, schema.tickets.projectId],
    ["invoices", schema.invoices, schema.invoices.projectId],
    ["expenses", schema.expenses, schema.expenses.projectId],
    ["metrics", schema.metrics, schema.metrics.projectId],
    ["feedback", schema.feedback, schema.feedback.projectId],
    ["status updates", schema.projectStatusUpdates, schema.projectStatusUpdates.projectId],
  ];
  for (const [label, table, col] of tables) {
    await db.delete(table).where(eq(col, pid));
    console.log(`· cleared ${label}`);
  }

  // 4. Verify the canvas is clean (project shell intact).
  const verify = async (label: string, table: any, col: any) => {
    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(table).where(eq(col, pid));
    return `${label}=${Number(n)}`;
  };
  const remaining = [
    await verify("milestones", schema.milestones, schema.milestones.projectId),
    await verify("features", schema.features, schema.features.projectId),
    await verify("issues", schema.issues, schema.issues.projectId),
    await verify("cycles", schema.cycles, schema.cycles.projectId),
    await verify("pages", schema.pages, schema.pages.projectId),
    await verify("campaigns", schema.campaigns, schema.campaigns.projectId),
    await verify("content", schema.contentItems, schema.contentItems.projectId),
    await verify("expenses", schema.expenses, schema.expenses.projectId),
  ];
  console.log(`\n✓ teardown complete. Project shell kept. Remaining: ${remaining.join(" · ")}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
