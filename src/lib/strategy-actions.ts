"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { projects } from "@/db/schema";
import { getWorkspace } from "@/lib/data";
import { isDepartmentEnabled } from "@/lib/departments";
import { applyStrategyOp, type StrategyModel, type StrategyOp } from "@/lib/strategy";

/**
 * Apply one StrategyOp to a project's strategyModel. Single-row read + write
 * (Neon HTTP — no transactions). Reducer logic lives in src/lib/strategy.ts.
 */
export async function applyStrategyOpAction(projectId: string, op: StrategyOp): Promise<void> {
  const ws = await getWorkspace();
  const [row] = await db
    .select({
      id: projects.id,
      enabledDepartments: projects.enabledDepartments,
      strategyModel: projects.strategyModel,
    })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, ws.id)))
    .limit(1);
  if (!row) throw new Error("Project not found");
  if (!isDepartmentEnabled(row.enabledDepartments, "strategy")) {
    throw new Error("Strategy surface is not enabled for this project");
  }
  const next = applyStrategyOp(row.strategyModel as StrategyModel | null, op);
  await db.update(projects).set({ strategyModel: next }).where(eq(projects.id, projectId));
  revalidatePath(`/projects/${projectId}/strategy`);
}
