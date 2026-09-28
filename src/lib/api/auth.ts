import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { apiKeys, workspaceMembers } from "@/db/schema";
import { hashKey } from "./keys";
import { loadScope, type ApiScope } from "./scope";

export type ApiAuth = {
  workspaceId: string;
  userId: string | null;
  keyId: string;
  /**
   * Whether this caller may do what the web app reserves for admins. Keys an
   * admin made in Settings always could; a mobile-app key carries the signed-in
   * member's current role, read on every request so a demotion takes effect at once.
   */
  isAdmin: boolean;
  /** "key" for a Settings-made integration key, "app" for a mobile sign-in. */
  kind: string;
  /** What this caller may see — everything, unless a member signed in on their phone. */
  scope: ApiScope;
};

/** Resolve the workspace from an `Authorization: Bearer <key>` (or `X-API-Key`)
 *  header. Returns null when missing/invalid. */
export async function authenticateApiKey(req: Request): Promise<ApiAuth | null> {
  const header = req.headers.get("authorization");
  const xKey = req.headers.get("x-api-key");
  const raw = header?.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : xKey?.trim();
  if (!raw) return null;

  const [row] = await db
    .select({
      id: apiKeys.id,
      workspaceId: apiKeys.workspaceId,
      createdBy: apiKeys.createdBy,
      kind: apiKeys.kind,
    })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hashKey(raw)))
    .limit(1);
  if (!row) return null;

  // Best-effort last-used timestamp (don't block the request on it).
  void db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id));

  let isAdmin = row.kind !== "app";
  if (row.kind === "app") {
    if (!row.createdBy) return null;
    const [m] = await db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, row.workspaceId), eq(workspaceMembers.userId, row.createdBy)))
      .limit(1);
    // Someone removed from the workspace keeps no access through their phone.
    if (!m) return null;
    isAdmin = m.role === "admin";
  }

  const scope = await loadScope(row.workspaceId, row.createdBy, isAdmin);
  return { workspaceId: row.workspaceId, userId: row.createdBy, keyId: row.id, isAdmin, kind: row.kind, scope };
}
