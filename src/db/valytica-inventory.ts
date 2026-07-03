import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq, isNotNull, sql } from "drizzle-orm";

import { db, schema } from "./index";

/**
 * Read-only inventory of everything currently under the Valytica project (key
 * VAL). Prints per-table counts so we can see exactly what a teardown would
 * remove — and flags signals of hand-entered (vs seeded) content: comments,
 * activity, notifications, and status updates are only created by real usage,
 * not by the seed scripts. TEMPORARY diagnostic — safe to delete after.
 */
async function main() {
  const [val] = await db
    .select({ id: schema.projects.id, name: schema.projects.name, key: schema.projects.key })
    .from(schema.projects)
    .where(eq(schema.projects.key, "VAL"));
  if (!val) {
    console.log("No Valytica project (key VAL) found.");
    process.exit(0);
  }
  const pid = val.id;
  console.log(`Valytica project: "${val.name}" (${val.key}) — ${pid}\n`);

  const count = async (label: string, q: Promise<{ n: number }[]>) => {
    const [{ n }] = await q;
    return { label, n: Number(n) };
  };
  const c = (table: any, where: any) =>
    db.select({ n: sql<number>`count(*)` }).from(table).where(where);

  // Project-scoped content (what a teardown would target).
  const scoped = [
    await count("milestones", c(schema.milestones, eq(schema.milestones.projectId, pid))),
    await count("features", c(schema.features, eq(schema.features.projectId, pid))),
    await count("issues (tickets/tasks)", c(schema.issues, eq(schema.issues.projectId, pid))),
    await count("cycles", c(schema.cycles, eq(schema.cycles.projectId, pid))),
    await count("pages (docs)", c(schema.pages, eq(schema.pages.projectId, pid))),
    await count("deals", c(schema.deals, eq(schema.deals.projectId, pid))),
    await count("campaigns", c(schema.campaigns, eq(schema.campaigns.projectId, pid))),
    await count("content items", c(schema.contentItems, eq(schema.contentItems.projectId, pid))),
    await count("invoices", c(schema.invoices, eq(schema.invoices.projectId, pid))),
    await count("expenses", c(schema.expenses, eq(schema.expenses.projectId, pid))),
    await count("support tickets", c(schema.tickets, eq(schema.tickets.projectId, pid))),
    await count("metrics", c(schema.metrics, eq(schema.metrics.projectId, pid))),
    await count("feedback", c(schema.feedback, eq(schema.feedback.projectId, pid))),
    await count("status updates", c(schema.projectStatusUpdates, eq(schema.projectStatusUpdates.projectId, pid))),
  ];
  console.log("── Project-scoped content ──");
  for (const r of scoped) console.log(`  ${r.label.padEnd(24)} ${r.n}`);

  // Hand-entered signals: comments/activity/notifications on Valytica issues.
  const issueIds = (
    await db.select({ id: schema.issues.id }).from(schema.issues).where(eq(schema.issues.projectId, pid))
  ).map((r) => r.id);
  let comments = 0, activityRows = 0, ticketComments = 0, githubLinked = 0;
  if (issueIds.length) {
    [{ n: comments }] = await db
      .select({ n: sql<number>`count(*)` })
      .from(schema.comments)
      .where(sql`${schema.comments.issueId} in ${issueIds}`) as any;
    [{ n: activityRows }] = await db
      .select({ n: sql<number>`count(*)` })
      .from(schema.activity)
      .where(sql`${schema.activity.issueId} in ${issueIds}`) as any;
    [{ n: githubLinked }] = await db
      .select({ n: sql<number>`count(*)` })
      .from(schema.issues)
      .where(and(eq(schema.issues.projectId, pid), isNotNull(schema.issues.githubUrl))) as any;
  }
  const ticketIds = (
    await db.select({ id: schema.tickets.id }).from(schema.tickets).where(eq(schema.tickets.projectId, pid))
  ).map((r) => r.id);
  if (ticketIds.length) {
    [{ n: ticketComments }] = await db
      .select({ n: sql<number>`count(*)` })
      .from(schema.ticketComments)
      .where(sql`${schema.ticketComments.ticketId} in ${ticketIds}`) as any;
  }
  console.log("\n── Hand-entered / real-usage signals ──");
  console.log(`  issue comments           ${Number(comments)}`);
  console.log(`  issue activity events    ${Number(activityRows)}`);
  console.log(`  support ticket comments  ${Number(ticketComments)}`);
  console.log(`  issues linked to GitHub  ${Number(githubLinked)}`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
