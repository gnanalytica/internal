import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { googleGrants } from "@/db/schema";
import { decryptSecret, encryptSecret, refreshAccessToken } from "./oauth";

export type GoogleGrant = typeof googleGrants.$inferSelect;

export async function getGrant(userId: string): Promise<GoogleGrant | null> {
  const [g] = await db.select().from(googleGrants).where(eq(googleGrants.userId, userId)).limit(1);
  return g ?? null;
}

export async function saveGrant(userId: string, email: string, scopes: string, refreshToken: string): Promise<void> {
  await db
    .insert(googleGrants)
    .values({ userId, email, scopes, refreshTokenEnc: encryptSecret(refreshToken) })
    .onConflictDoUpdate({ target: googleGrants.userId, set: { email, scopes, refreshTokenEnc: encryptSecret(refreshToken) } });
}

export async function deleteGrant(userId: string): Promise<void> {
  await db.delete(googleGrants).where(eq(googleGrants.userId, userId));
}

const cache = new Map<string, { token: string; expiresAt: number }>();

/** A fresh access token for a user, from their stored refresh token. */
export async function accessTokenFor(grant: GoogleGrant): Promise<string> {
  const hit = cache.get(grant.userId);
  if (hit && hit.expiresAt > Date.now() + 60_000) return hit.token;
  const t = await refreshAccessToken(decryptSecret(grant.refreshTokenEnc));
  cache.set(grant.userId, t);
  return t.token;
}

export async function listGrants(): Promise<GoogleGrant[]> {
  return db.select().from(googleGrants);
}
