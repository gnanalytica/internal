import "server-only";

import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { activity, issues, projects } from "@/db/schema";

/*
 * One way to move tasks between projects, for the web actions and the
 * /api/v1 routes (the phone app and the MCP server) alike.
 */

/**
 * Move tasks into another project (or none), renumbering them there.
 *
 * A task's number is per project and unique within it, so a task can't keep
 * ENG-12 when it lands in OPS: it takes the next free OPS number. Cycles,
 * milestones and features belong to one project, so a move clears them.
 * One UPDATE does the numbering so the max and the writes can't interleave
 * with a create; if a concurrent create still takes a number first, the unique
 * index rejects the statement and we go again.
 */
export async function moveIssuesToProject(
  workspaceId: string,
  /** Who moved them, for the timeline; null for an API key with no user. */
  actorId: string | null,
  ids: string[],
  projectId: string | null,
): Promise<number> {
  if (ids.length === 0) return 0;
  if (projectId) {
    const [target] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, projectId)))
      .limit(1);
    if (!target) throw new Error("Project not found");
  }

  const before = await db
    .select({ id: issues.id, number: issues.number, projectKey: projects.key })
    .from(issues)
    .leftJoin(projects, eq(projects.id, issues.projectId))
    .where(
      and(
        eq(issues.workspaceId, workspaceId),
        inArray(issues.id, ids),
        projectId ? or(isNull(issues.projectId), sql`${issues.projectId} <> ${projectId}`) : sql`${issues.projectId} IS NOT NULL`,
      ),
    );
  if (before.length === 0) return 0;
  const moving = before.map((b) => b.id);
  const idList = sql.join(moving.map((m) => sql`${m}::uuid`), sql`, `);

  // Same scope createIssue numbers against: the project, or the whole
  // workspace for tasks with no project.
  const scope = projectId
    ? sql`workspace_id = ${workspaceId} AND project_id = ${projectId}`
    : sql`workspace_id = ${workspaceId}`;

  let result: { rows: unknown[] } | null = null;
  for (let attempt = 0; attempt < 3 && !result; attempt++) {
    try {
      result = await db.execute(sql`
        UPDATE issues AS i
        SET project_id = ${projectId},
            number = base.m + s.rn,
            cycle_id = NULL,
            milestone_id = NULL,
            feature_id = NULL,
            updated_at = now()
        FROM (
          SELECT id, row_number() OVER (ORDER BY number, created_at) AS rn
          FROM issues WHERE id IN (${idList})
        ) AS s,
        (SELECT coalesce(max(number), 0) AS m FROM issues WHERE ${scope}) AS base
        WHERE i.id = s.id AND i.workspace_id = ${workspaceId}
        RETURNING i.id, i.number`);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "23505" || attempt === 2) throw e;
    }
  }

  let toKey: string | null = null;
  if (projectId) {
    const [p] = await db.select({ key: projects.key }).from(projects).where(eq(projects.id, projectId));
    toKey = p?.key ?? null;
  }
  const label = (key: string | null, n: number) => (key ? `${key}-${n}` : `#${n}`);
  const after = new Map(
    (result!.rows as { id: string; number: number }[]).map((r) => [r.id, r.number]),
  );
  // Recorded as the identifiers it had and has, so the timeline reads
  // "moved ENG-12 to OPS-41" without looking anything up.
  const acts = before
    .filter((b) => after.has(b.id))
    .map((b) => ({
      workspaceId,
      issueId: b.id,
      actorId,
      type: "project",
      data: { from: label(b.projectKey, b.number), to: label(toKey, after.get(b.id)!) },
    }));
  if (acts.length) await db.insert(activity).values(acts);
  return acts.length;
}
