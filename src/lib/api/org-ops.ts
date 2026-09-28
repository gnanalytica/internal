import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { orgRoles, workspaceMembers } from "@/db/schema";

import { ApiInputError } from "./errors";
import { apiInvalidate } from "./invalidate";
import { wouldCreateLoop } from "./org-rules";

async function assertMember(workspaceId: string, userId: string): Promise<void> {
  const [m] = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);
  if (!m) throw new ApiInputError("`userId` is not a member of this workspace.");
}

const str = (v: unknown): string | null => (v === null || v === undefined || v === "" ? null : String(v));

/**
 * Update a role, as the web's `updateOrgRole` does: the person and the parent
 * must belong to this workspace, and a role may not end up reporting to itself
 * or anyone below it. Returns false when there is no such role.
 */
export async function apiUpdateOrgRole(
  workspaceId: string,
  id: string,
  patch: { title?: unknown; userId?: unknown; parentId?: unknown },
): Promise<boolean> {
  const rows = await db.select({ id: orgRoles.id, parentId: orgRoles.parentId }).from(orgRoles).where(eq(orgRoles.workspaceId, workspaceId));
  if (!rows.some((r) => r.id === id)) return false;

  const values: { title?: string; userId?: string | null; parentId?: string | null } = {};
  if (patch.title !== undefined) {
    const title = String(patch.title ?? "").trim();
    if (!title) throw new ApiInputError("`title` can't be empty.");
    values.title = title.slice(0, 200);
  }
  if (patch.userId !== undefined) {
    const userId = str(patch.userId);
    if (userId) await assertMember(workspaceId, userId);
    values.userId = userId;
  }
  if (patch.parentId !== undefined) {
    const parentId = str(patch.parentId);
    if (parentId) {
      if (!rows.some((r) => r.id === parentId)) throw new ApiInputError("`parentId` is not a role in this workspace.");
      if (parentId === id) throw new ApiInputError("A role can't report to itself.");
      const parentOf = new Map(rows.map((r) => [r.id, r.parentId]));
      if (wouldCreateLoop(parentOf, id, parentId)) throw new ApiInputError("That would create a reporting loop.");
    }
    values.parentId = parentId;
  }
  if (Object.keys(values).length === 0) return true;
  await db.update(orgRoles).set(values).where(and(eq(orgRoles.workspaceId, workspaceId), eq(orgRoles.id, id)));
  apiInvalidate(workspaceId, "org");
  return true;
}

/**
 * Delete a role, moving its direct reports up to its own parent so the
 * subtree stays attached — the web's `deleteOrgRole`. Returns false when
 * there is no such role.
 */
export async function apiDeleteOrgRole(workspaceId: string, id: string): Promise<boolean> {
  const [target] = await db
    .select({ parentId: orgRoles.parentId })
    .from(orgRoles)
    .where(and(eq(orgRoles.workspaceId, workspaceId), eq(orgRoles.id, id)))
    .limit(1);
  if (!target) return false;
  await db.update(orgRoles).set({ parentId: target.parentId }).where(and(eq(orgRoles.workspaceId, workspaceId), eq(orgRoles.parentId, id)));
  await db.delete(orgRoles).where(and(eq(orgRoles.workspaceId, workspaceId), eq(orgRoles.id, id)));
  apiInvalidate(workspaceId, "org");
  return true;
}
