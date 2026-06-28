import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq, max } from "drizzle-orm";

import { db, schema } from "./index";

/**
 * Fully separate the products on the hub: move Valytica's shipped feasibility
 * work — the "Project Engagements — TEV / LIE / DPR" feature and its tasks —
 * over to Atlas, so Valytica is pure property valuation.
 *
 * Faithful to history: the work really shipped inside Valytica, so it lands in
 * Atlas under a dedicated milestone "Engine built in Valytica · carved out"
 * (original May-2026 dates kept) with a provenance note on the feature, rather
 * than pretending Atlas built it from scratch.
 *
 * Idempotent: re-running is a no-op once the feature already lives in Atlas.
 * Run: npx tsx --env-file=.env.local src/db/move-feasibility-to-atlas.ts
 */

const FEATURE_TITLE = "Project Engagements — TEV / LIE / DPR";
const BUILT_MS = "Engine built in Valytica · carved out";

type Node = { type: string; attrs?: Record<string, unknown>; content?: Node[]; text?: string };

async function main() {
  const [ws] = await db
    .select({ id: schema.workspaces.id })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.slug, "gnanalytica"))
    .limit(1);
  if (!ws) return console.log("No gnanalytica workspace.");

  const [valytica] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(and(eq(schema.projects.workspaceId, ws.id), eq(schema.projects.name, "Valytica")))
    .limit(1);
  const [atlas] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(and(eq(schema.projects.workspaceId, ws.id), eq(schema.projects.name, "Atlas")))
    .limit(1);
  if (!valytica || !atlas) return console.log("Missing Valytica or Atlas project.");

  // 1. The feasibility feature (find by title in either project).
  const [feature] = await db
    .select({ id: schema.features.id, projectId: schema.features.projectId, spec: schema.features.spec })
    .from(schema.features)
    .where(and(eq(schema.features.workspaceId, ws.id), eq(schema.features.title, FEATURE_TITLE)))
    .limit(1);
  if (!feature) return console.log(`Feature "${FEATURE_TITLE}" not found — nothing to move.`);
  if (feature.projectId === atlas.id) return console.log("Already in Atlas — nothing to do.");

  // 2. Ensure the "built in Valytica" milestone exists on Atlas.
  let [builtMs] = await db
    .select({ id: schema.milestones.id })
    .from(schema.milestones)
    .where(and(eq(schema.milestones.projectId, atlas.id), eq(schema.milestones.name, BUILT_MS)))
    .limit(1);
  if (!builtMs) {
    [builtMs] = await db
      .insert(schema.milestones)
      .values({
        workspaceId: ws.id,
        projectId: atlas.id,
        name: BUILT_MS,
        description:
          "The TEV / LIE / DPR engagement engine was built and shipped inside Valytica (May 2026). It is being carved out into Atlas as its own product.",
        targetDate: new Date("2026-05-30T12:00:00Z"),
        sortKey: "a00", // sorts before the forward milestones (m00…)
      })
      .returning({ id: schema.milestones.id });
  }

  // 3. Move the feature → Atlas, attach to the built milestone, note provenance.
  const existing = (feature.spec as Node | null)?.content ?? [];
  const note: Node = {
    type: "paragraph",
    content: [
      {
        type: "text",
        text: "Built inside Valytica and shipped (May 2026); carved out into Atlas as the feasibility product.",
      },
    ],
  };
  await db
    .update(schema.features)
    .set({
      projectId: atlas.id,
      milestoneId: builtMs.id,
      sortKey: "a00",
      spec: { type: "doc", content: [note, ...existing] },
      updatedAt: new Date(),
    })
    .where(eq(schema.features.id, feature.id));

  // 4. Move its tasks → Atlas with fresh per-project numbers (no cycle carry-over).
  const tasks = await db
    .select({ id: schema.issues.id })
    .from(schema.issues)
    .where(and(eq(schema.issues.featureId, feature.id), eq(schema.issues.projectId, valytica.id)));

  const [{ value: atlasMax }] = await db
    .select({ value: max(schema.issues.number) })
    .from(schema.issues)
    .where(and(eq(schema.issues.workspaceId, ws.id), eq(schema.issues.projectId, atlas.id)));
  let next = (atlasMax ?? 0) + 1;

  for (const t of tasks) {
    await db
      .update(schema.issues)
      .set({ projectId: atlas.id, cycleId: null, number: next++ })
      .where(eq(schema.issues.id, t.id));
  }

  console.log(`Moved feature "${FEATURE_TITLE}" + ${tasks.length} tasks from Valytica → Atlas.`);
  console.log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
