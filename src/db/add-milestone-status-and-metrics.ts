import { config } from "dotenv";
config({ path: ".env.local" });
import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { projects, metrics } from "./schema";

/** Idempotent: add milestones.status, then load Valytica's tracking metrics. */

// The Quantitative Tracking table from the MVP Launch Plan.
const TRACKED: [name: string, unit: string | null, cadence: string][] = [
  ["Documents labelled for extraction training (target 50+)", "docs", "weekly"],
  ["Extraction accuracy — key fields (target ≥90%)", "%", "weekly"],
  ["FE changes complete (target 100%)", "%", "weekly"],
  ["Backend feature complete (target 100%)", "%", "weekly"],
  ["Open P0 / P1 defects (target 0)", "defects", "weekly"],
  ["Time to produce one report (target ≤30 min)", "min", "weekly"],
  ["PDF generation time (target <30 sec)", "sec", "weekly"],
  ["Page load P95 (target <3 sec)", "sec", "weekly"],
  ["AI + infra cost per report (target <₹40)", "₹", "weekly"],
  ["Security review findings closed (target 100% critical)", "%", "weekly"],
  ["Production smoke test pass (target 100%)", "%", "weekly"],
  ["Launch-ready leads (target ≥5)", "leads", "weekly"],
  ["LinkedIn posts published (target 12+)", "posts", "weekly"],
  ["Blogs + newsletters (target 4+)", "pieces", "weekly"],
  ["WhatsApp group members (target 50+)", "members", "weekly"],
  ["Downloadable resource captures (target 25+)", "captures", "weekly"],
  ["Tickets updated on time (target ≥90%)", "%", "weekly"],
  ["Uptime (target ≥99.5%)", "%", "weekly"],
  ["P0 mean time to resolve (target <4h)", "hours", "weekly"],
];

const NORTH_STAR = "Extraction accuracy — key fields (target ≥90%)";

async function main() {
  await db.execute(
    sql`alter table milestones add column if not exists status text not null default 'planned'`,
  );
  console.log("milestones.status  added (default 'planned')");

  const [project] = await db.select().from(projects).where(eq(projects.key, "VAL"));
  if (!project) throw new Error("Valytica project not found");

  await db.delete(metrics).where(eq(metrics.projectId, project.id));
  await db.insert(metrics).values(
    TRACKED.map(([name, unit, cadence], i) => ({
      workspaceId: project.workspaceId,
      projectId: project.id,
      name,
      unit,
      cadence,
      isNorthStar: name === NORTH_STAR,
      sortKey: `a${String(i).padStart(3, "0")}`,
    })),
  );
  console.log(`metrics            ${TRACKED.length} loaded (north star: extraction accuracy)`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
