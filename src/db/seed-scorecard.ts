import { config } from "dotenv";
config({ path: ".env.local" });
import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { metricPoints, metrics, projects } from "./schema";
import { SUGGESTED_METRICS, suggestedSortKey } from "../lib/scorecard";

/**
 * Idempotent: put Valytica's thirteen scorecard metrics in place (see
 * SUGGESTED_METRICS in src/lib/scorecard.ts). Run src/db/add-metric-source.ts
 * first. For each one:
 *
 *  - already on the scorecard under its name (a source or area other than the
 *    column defaults, or a typed-in Product metric, which the defaults already
 *    place) → left exactly as it is, so edits made since survive;
 *  - in the old Analytics list but not yet placed — same name, or a name it
 *    had there ("P0 mean time to resolve") → adopted: renamed, given its unit,
 *    target, source and area, and its points kept;
 *  - missing → added.
 *
 * Old metrics that aren't on the scorecard are listed, not touched. With
 * `--drop-old`, the five the design drops (task progress Engineering already
 * shows) are deleted, but only if they have no points recorded.
 *
 *     pnpm tsx --env-file=.env.local src/db/seed-scorecard.ts [--drop-old]
 */

const DROPPED = ["FE changes complete", "Backend feature complete", "Security review findings closed", "Production smoke test pass", "Tickets updated on time"];

const norm = (s: string) => s.trim().toLowerCase();

async function main() {
  const [project] = await db.select().from(projects).where(eq(projects.key, "VAL"));
  if (!project) throw new Error("Valytica project not found");

  const existing = await db
    .select({ id: metrics.id, name: metrics.name, source: metrics.source, area: metrics.area })
    .from(metrics)
    .where(eq(metrics.projectId, project.id));
  const claimed = new Set<string>();

  for (const [i, m] of SUGGESTED_METRICS.entries()) {
    const names = [m.name, ...(m.formerly ?? [])].map(norm);
    const match = existing.find((e) => !claimed.has(e.id) && names.includes(norm(e.name)));
    const fields = {
      name: m.name,
      unit: m.unit,
      cadence: "weekly",
      target: m.target,
      targetDirection: m.targetDirection,
      source: m.source,
      area: m.area,
      sortKey: suggestedSortKey(i),
    };
    if (!match) {
      await db.insert(metrics).values({ workspaceId: project.workspaceId, projectId: project.id, ...fields });
      console.log(`added    ${m.name}`);
      continue;
    }
    claimed.add(match.id);
    // A typed-in Product metric sits where the defaults already put it, so under its own name it is placed too.
    const placed = match.source !== "manual" || match.area !== "product" || (m.source === "manual" && m.area === "product");
    if (placed && norm(match.name) === norm(m.name)) {
      console.log(`kept     ${m.name}`);
      continue;
    }
    await db.update(metrics).set(fields).where(eq(metrics.id, match.id));
    console.log(`adopted  ${m.name}${norm(match.name) === norm(m.name) ? "" : `  (was "${match.name}")`}`);
  }

  const gone = new Set<string>();
  if (process.argv.includes("--drop-old")) {
    for (const d of existing.filter((e) => !claimed.has(e.id) && DROPPED.map(norm).includes(norm(e.name)))) {
      const [point] = await db.select({ id: metricPoints.id }).from(metricPoints).where(eq(metricPoints.metricId, d.id)).limit(1);
      if (point) {
        console.log(`not dropped  ${d.name}  (it has points recorded)`);
        continue;
      }
      await db.delete(metrics).where(and(eq(metrics.id, d.id), eq(metrics.projectId, project.id)));
      gone.add(d.id);
      console.log(`dropped  ${d.name}`);
    }
  }
  const rest = existing.filter((e) => !claimed.has(e.id) && !gone.has(e.id) && e.source === "manual" && e.area === "product");
  if (rest.length) console.log(`\nAlso in Product, typed in, not part of the suggested set:\n${rest.map((e) => `  - ${e.name}`).join("\n")}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
