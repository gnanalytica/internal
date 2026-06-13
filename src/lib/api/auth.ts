import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { hashKey } from "./keys";

export type ApiAuth = {
  workspaceId: string;
  userId: string | null;
  keyId: string;
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

  return { workspaceId: row.workspaceId, userId: row.createdBy, keyId: row.id };
}
