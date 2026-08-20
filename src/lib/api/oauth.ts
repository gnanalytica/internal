import "server-only";

import crypto from "node:crypto";
import { and, eq, isNull, lt } from "drizzle-orm";

import { db } from "@/db";
import { oauthCodes } from "@/db/schema";

// The client registry and its predicates live in a db-free module so they can
// be unit-tested; re-exported here so callers have a single import site.
export {
  findClient,
  redirectUriAllowed,
  registeredClients,
  secretMatches,
  type OAuthClient,
} from "./oauth-clients";

/**
 * The "Connect" handshake — an OAuth2 authorization-code flow with a
 * confidential client.
 *
 * Why a real flow and not a shared secret in a config file: the point is that
 * nobody hand-copies an API key or a webhook secret between two systems. The
 * user clicks Connect, approves here, and the client walks away with a
 * workspace-scoped key it minted itself. Nothing sensitive is ever displayed,
 * pasted, or pinned in a settings screen where it can be leaked or go stale.
 *
 * There is no dynamic client registration: clients are configured out-of-band
 * via env. That is deliberate — this hub serves a small number of known
 * first-party integrations, and a registration endpoint would be a larger
 * attack surface than the problem warrants.
 */

/** Codes are short-lived: a redirect round-trip is seconds, not minutes. */
const CODE_TTL_SECONDS = 120;

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/** Mint a single-use authorization code bound to (client, redirect, workspace). */
export async function issueCode(input: {
  clientId: string;
  redirectUri: string;
  workspaceId: string;
  userId: string | null;
}): Promise<string> {
  const code = crypto.randomBytes(32).toString("base64url");
  await db.insert(oauthCodes).values({
    codeHash: hashCode(code),
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    workspaceId: input.workspaceId,
    userId: input.userId,
    expiresAt: new Date(Date.now() + CODE_TTL_SECONDS * 1000),
  });
  return code;
}

export type RedeemedCode = { workspaceId: string; userId: string | null };

/**
 * Redeem a code exactly once.
 *
 * The `usedAt IS NULL` predicate is part of the UPDATE, so two concurrent
 * redemptions of the same code race in the database and exactly one wins —
 * checking-then-updating in application code would let both through.
 *
 * `clientId` and `redirectUri` must match what the code was issued for: a code
 * leaked to another client, or replayed against a different callback, is
 * refused rather than honoured.
 */
export async function redeemCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
}): Promise<RedeemedCode | null> {
  const rows = await db
    .update(oauthCodes)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(oauthCodes.codeHash, hashCode(input.code)),
        eq(oauthCodes.clientId, input.clientId),
        eq(oauthCodes.redirectUri, input.redirectUri),
        isNull(oauthCodes.usedAt),
      ),
    )
    .returning();
  const row = rows[0];
  if (!row) return null;
  // Expiry is checked AFTER the atomic claim so an expired code is still burned
  // rather than left redeemable.
  if (row.expiresAt.getTime() < Date.now()) return null;
  return { workspaceId: row.workspaceId, userId: row.userId };
}

/** Best-effort housekeeping: drop codes that can no longer be redeemed. */
export async function purgeExpiredCodes(): Promise<void> {
  await db.delete(oauthCodes).where(lt(oauthCodes.expiresAt, new Date()));
}
