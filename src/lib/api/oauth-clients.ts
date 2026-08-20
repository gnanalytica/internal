import crypto from "node:crypto";

/**
 * Client registry + the security-critical predicates of the Connect flow.
 *
 * Split from `oauth.ts` (which touches the database and is `server-only`) so
 * these can be unit-tested directly — they are the parts where a subtle mistake
 * silently hands an authorization code to the wrong party, which is exactly the
 * kind of bug that never shows up in manual testing because the happy path
 * looks identical.
 */

export type OAuthClient = {
  id: string;
  secret: string;
  name: string;
  redirectUris: string[];
};

/**
 * Registered clients, from env:
 *   OAUTH_CLIENT_STANDUP_ID / _SECRET / _REDIRECT_URIS (comma-separated)
 *
 * Returns [] when unset — an unconfigured deployment exposes no authorization
 * surface at all, rather than a half-configured one that might accept a guess.
 *
 * There is no dynamic client registration on purpose: this hub serves a small
 * number of known first-party integrations, and a registration endpoint is a
 * much larger attack surface than the problem warrants.
 */
export function registeredClients(env: NodeJS.ProcessEnv = process.env): OAuthClient[] {
  const id = (env.OAUTH_CLIENT_STANDUP_ID ?? "").trim();
  const secret = (env.OAUTH_CLIENT_STANDUP_SECRET ?? "").trim();
  const redirectUris = (env.OAUTH_CLIENT_STANDUP_REDIRECT_URIS ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  if (!id || !secret || redirectUris.length === 0) return [];
  return [{ id, secret, name: "Standup AI", redirectUris }];
}

export function findClient(
  clientId: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): OAuthClient | null {
  const wanted = (clientId ?? "").trim();
  if (!wanted) return null;
  return registeredClients(env).find((c) => c.id === wanted) ?? null;
}

/**
 * Exact-match the redirect URI against the client's registered list.
 *
 * EXACT, never prefix or startsWith: a prefix check on
 * `https://app.example.com` also matches `https://app.example.com.evil.test`,
 * which hands the authorization code straight to an attacker.
 */
export function redirectUriAllowed(client: OAuthClient, redirectUri: string): boolean {
  return client.redirectUris.includes(redirectUri);
}

/**
 * Constant-time secret comparison.
 *
 * `timingSafeEqual` throws on a length mismatch, so the lengths are compared
 * first — that leak (the length of a secret) is not meaningful, whereas
 * comparing byte-by-byte with `===` leaks the shared prefix and makes the
 * secret guessable one character at a time.
 */
export function secretMatches(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
