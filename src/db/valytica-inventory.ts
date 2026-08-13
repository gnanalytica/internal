import { config } from "dotenv";
config({ path: ".env.local" });
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "./index";
import {
  projects, issues, pages, cycles, milestones, features, deals, crmActivities,
  campaigns, contentItems, invoices, expenses, metrics, feedback,
  projectStatusUpdates, tickets, crmAccounts, crmContacts,
} from "./schema";

/** READ-ONLY: inventory all content attached to the Valytica project. */
async function main() {
  const projs = await db
    .select({ id: projects.id, name: projects.name, key: projects.key })
    .from(projects)
    .where(sql`lower(${projects.name}) like '%valytica%'`);
  if (projs.length === 0) {
    console.log("No project matching 'valytica' found. All projects:");
    const all = await db.select({ id: projects.id, name: projects.name }).from(projects);
    for (const p of all) console.log(`  ${p.name}  (${p.id})`);
    return;
  }
  for (const p of projs) console.log(`PROJECT: "${p.name}" [${p.key}]  ${p.id}`);
  const pid = projs[0].id;

  const count = async (label: string, q: Promise<{ n: number }[]>) => {
    const [r] = await q;
    console.log(`  ${label.padEnd(22)} ${r.n}`);
  };
  const N = sql<number>`count(*)::int`;
  console.log("\nPROJECT-SCOPED CONTENT:");
  await count("issues", db.select({ n: N }).from(issues).where(eq(issues.projectId, pid)));
  await count("pages", db.select({ n: N }).from(pages).where(eq(pages.projectId, pid)));
  await count("cycles", db.select({ n: N }).from(cycles).where(eq(cycles.projectId, pid)));
  await count("milestones", db.select({ n: N }).from(milestones).where(eq(milestones.projectId, pid)));
  await count("features", db.select({ n: N }).from(features).where(eq(features.projectId, pid)));
  await count("tickets", db.select({ n: N }).from(tickets).where(eq(tickets.projectId, pid)));
  await count("deals", db.select({ n: N }).from(deals).where(eq(deals.projectId, pid)));
  await count("crmActivities", db.select({ n: N }).from(crmActivities).where(eq(crmActivities.projectId, pid)));
  await count("campaigns", db.select({ n: N }).from(campaigns).where(eq(campaigns.projectId, pid)));
  await count("contentItems", db.select({ n: N }).from(contentItems).where(eq(contentItems.projectId, pid)));
  await count("invoices", db.select({ n: N }).from(invoices).where(eq(invoices.projectId, pid)));
  await count("expenses", db.select({ n: N }).from(expenses).where(eq(expenses.projectId, pid)));
  await count("metrics", db.select({ n: N }).from(metrics).where(eq(metrics.projectId, pid)));
  await count("feedback", db.select({ n: N }).from(feedback).where(eq(feedback.projectId, pid)));
  await count("statusUpdates", db.select({ n: N }).from(projectStatusUpdates).where(eq(projectStatusUpdates.projectId, pid)));

  console.log("\nSHARED CRM (workspace-wide, NOT project-scoped — review separately):");
  const [ac] = await db.select({ n: N }).from(crmAccounts);
  const [cc] = await db.select({ n: N }).from(crmContacts);
  console.log(`  crmAccounts (all)      ${ac.n}`);
  console.log(`  crmContacts (all)      ${cc.n}`);
  void and; void isNull;
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
