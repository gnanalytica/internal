import { config } from "dotenv";
config({ path: ".env.local" });
import { writeFileSync } from "node:fs";
import { eq, inArray, or, sql } from "drizzle-orm";
import { db } from "./index";
import {
  projects, issues, pages, cycles, milestones, features, deals, crmActivities,
  campaigns, contentItems, invoices, expenses, metrics, feedback,
  projectStatusUpdates, tickets, references, favorites,
} from "./schema";

const BACKUP = process.argv[2];
if (!BACKUP) throw new Error("usage: tsx clear-projects.ts <backup.json>");

/** Clear all content attached to the Standup and AI Workshop projects.
 *  Project rows themselves are kept. Neon HTTP: no transactions — sequential
 *  and idempotent, safe to re-run. */
async function main() {
  const targets = await db
    .select({ id: projects.id, name: projects.name, key: projects.key })
    .from(projects)
    .where(sql`lower(${projects.name}) like '%standup%' or lower(${projects.name}) like '%ai workshop%'`);

  if (targets.length === 0) {
    const all = await db.select({ id: projects.id, name: projects.name }).from(projects);
    console.log("No match. All projects:");
    for (const p of all) console.log(`  ${p.name}  (${p.id})`);
    return;
  }
  console.log("TARGETS:");
  for (const p of targets) console.log(`  "${p.name}" [${p.key}]  ${p.id}`);
  const pids = targets.map((p) => p.id);

  // Parent tables scoped by projectId. Children (comments, activity, labels,
  // page versions, ticket comments, metric points, …) cascade via FK.
  const scoped = [
    ["issues", issues], ["pages", pages], ["cycles", cycles],
    ["milestones", milestones], ["features", features], ["tickets", tickets],
    ["deals", deals], ["crmActivities", crmActivities], ["campaigns", campaigns],
    ["contentItems", contentItems], ["invoices", invoices], ["expenses", expenses],
    ["metrics", metrics], ["feedback", feedback],
    ["projectStatusUpdates", projectStatusUpdates],
  ] as const;

  // 1. Back everything up before touching a row.
  const backup: Record<string, unknown[]> = { _projects: targets };
  for (const [label, table] of scoped) {
    backup[label] = await db.select().from(table).where(inArray(table.projectId, pids));
  }
  const issueIds = (backup.issues as { id: string }[]).map((r) => r.id);
  const pageIds = (backup.pages as { id: string }[]).map((r) => r.id);
  const loose = [...issueIds, ...pageIds, ...pids];
  backup._references = loose.length
    ? await db.select().from(references)
        .where(or(inArray(references.sourceId, loose), inArray(references.targetId, loose)))
    : [];
  backup._favorites = loose.length
    ? await db.select().from(favorites).where(inArray(favorites.targetId, loose))
    : [];
  writeFileSync(BACKUP, JSON.stringify(backup, null, 2));
  console.log(`\nbackup → ${BACKUP}`);

  // 2. Orphan-prone tables first (no FK to issues/pages).
  if (loose.length) {
    await db.delete(references)
      .where(or(inArray(references.sourceId, loose), inArray(references.targetId, loose)));
    await db.delete(favorites).where(inArray(favorites.targetId, loose));
  }

  // 3. Project-scoped content.
  console.log("\nDELETED:");
  for (const [label, table] of scoped) {
    await db.delete(table).where(inArray(table.projectId, pids));
    console.log(`  ${label.padEnd(22)} ${(backup[label] as unknown[]).length}`);
  }
  console.log(`  ${"references".padEnd(22)} ${(backup._references as unknown[]).length}`);
  console.log(`  ${"favorites".padEnd(22)} ${(backup._favorites as unknown[]).length}`);
  console.log("\nProject rows kept.");
  void eq;
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
