import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq, inArray } from "drizzle-orm";

import { db, schema } from "./index";
import { planReorg } from "./reorg-plan";

/**
 * In-place, idempotent migration of the existing Gnanalytica workspace to the
 * redesigned org structure. Safe to re-run. See
 * docs/superpowers/specs/2026-06-25-org-structure-redesign-design.md.
 *
 * Run: npm run db:reorg-org
 */

const POD_META: Record<string, { key: string; icon: string; color: string }> = {
  Products: { key: "PROD", icon: "🚀", color: "#6366f1" },
  Platform: { key: "PLAT", icon: "🛠️", color: "#3b82f6" },
};

async function main() {
  const [ws] = await db
    .select({ id: schema.workspaces.id })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.slug, "gnanalytica"))
    .limit(1);
  if (!ws) {
    console.log("No gnanalytica workspace — run db:seed-org first. Nothing to do.");
    return;
  }

  const teams = await db
    .select({ id: schema.teams.id, name: schema.teams.name })
    .from(schema.teams)
    .where(eq(schema.teams.workspaceId, ws.id));
  const projects = await db
    .select({
      id: schema.projects.id,
      name: schema.projects.name,
      kind: schema.projects.kind,
      ownerTeamId: schema.projects.ownerTeamId,
    })
    .from(schema.projects)
    .where(eq(schema.projects.workspaceId, ws.id));
  const databases = await db
    .select({ id: schema.databases.id, name: schema.databases.name })
    .from(schema.databases)
    .where(eq(schema.databases.workspaceId, ws.id));

  const plan = planReorg({ teams, projects, databases });
  if (plan.isNoop) {
    console.log("Org already in the redesigned shape — no changes.");
    return;
  }

  await db.transaction(async (tx) => {
    // 1. Ensure pods exist; collect their ids by name.
    const podIdByName = new Map<string, string>();
    for (const t of teams) podIdByName.set(t.name, t.id);
    for (const pod of plan.pods) {
      const meta = POD_META[pod.name];
      const [row] = await tx
        .insert(schema.teams)
        .values({
          workspaceId: ws.id,
          name: pod.name,
          key: meta.key,
          icon: meta.icon,
          color: meta.color,
        })
        .returning({ id: schema.teams.id });
      podIdByName.set(pod.name, row.id);
    }

    // 2. Add all workspace members to each pod.
    const members = await tx
      .select({ userId: schema.workspaceMembers.userId })
      .from(schema.workspaceMembers)
      .where(eq(schema.workspaceMembers.workspaceId, ws.id));
    for (const podName of ["Products", "Platform"]) {
      const podId = podIdByName.get(podName)!;
      for (const m of members) {
        await tx
          .insert(schema.teamMembers)
          .values({ teamId: podId, userId: m.userId })
          .onConflictDoNothing();
      }
    }

    // 3. Renames.
    for (const r of plan.projectRenames) {
      await tx.update(schema.projects).set({ name: r.to }).where(eq(schema.projects.id, r.id));
    }

    // 4. Set kind + ownerTeamId per project.
    for (const u of plan.projectUpdates) {
      await tx
        .update(schema.projects)
        .set({ kind: u.kind, ownerTeamId: u.ownerPod ? podIdByName.get(u.ownerPod)! : null })
        .where(eq(schema.projects.id, u.id));
    }

    // 5. Remap issues off old product-mirror teams to their pod. plan.teamToPod
    //    is keyed by the OLD team id -> pod name; must run before the team
    //    deletes in step 7.
    for (const [oldTeamId, podName] of Object.entries(plan.teamToPod)) {
      const podId = podIdByName.get(podName);
      if (!podId) continue;
      await tx
        .update(schema.issues)
        .set({ teamId: podId })
        .where(eq(schema.issues.teamId, oldTeamId));
    }

    // 6. Merge Vendors rows into Tools & Subscriptions, then the Vendors DB is
    //    deleted in step 7.
    if (plan.mergeVendorsIntoToolsId) {
      await tx
        .update(schema.databaseRows)
        .set({ databaseId: plan.mergeVendorsIntoToolsId.to })
        .where(eq(schema.databaseRows.databaseId, plan.mergeVendorsIntoToolsId.from));
    }

    // 7. Deletes.
    if (plan.deleteProjectIds.length) {
      await tx.delete(schema.projects).where(inArray(schema.projects.id, plan.deleteProjectIds));
    }
    if (plan.deleteDatabaseIds.length) {
      await tx.delete(schema.databases).where(inArray(schema.databases.id, plan.deleteDatabaseIds));
    }
    if (plan.deleteTeamIds.length) {
      await tx.delete(schema.teams).where(inArray(schema.teams.id, plan.deleteTeamIds));
    }

    // 8. Drop the now-empty Compliance & Legal initiative.
    await tx
      .delete(schema.initiatives)
      .where(
        and(
          eq(schema.initiatives.workspaceId, ws.id),
          eq(schema.initiatives.name, "Compliance & Legal"),
        ),
      );
  });

  console.log("Reorg applied.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
