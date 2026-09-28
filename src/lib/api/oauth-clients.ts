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
  /** Empty for a public client, which proves itself with PKCE instead. */
  secret: string;
  name: string;
  redirectUris: string[];
  /**
   * "confidential": a server that keeps a secret and connects a whole workspace
   * (admins only; the key acts with admin rights).
   * "public": the mobile app, which cannot keep a secret. Any member may sign
   * in, PKCE is mandatory, and the key acts with that member's own role.
   */
  type: "confidential" | "public";
};

/** The mobile app. Public by nature: anything shipped in an APK can be read out of it. */
export const MOBILE_CLIENT_ID = "internal-mobile";
export const MOBILE_REDIRECT_URI = "internal://oauth";

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
  const clients: OAuthClient[] = [];
  if (id && secret && redirectUris.length > 0) clients.push({ id, secret, name: "Standup AI", redirectUris, type: "confidential" });
  // Extra callbacks for development builds (Expo Go serves exp://<host>/--/oauth).
  const devRedirects = (env.OAUTH_MOBILE_DEV_REDIRECT_URIS ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  clients.push({ id: MOBILE_CLIENT_ID, secret: "", name: "Internal mobile app", redirectUris: [MOBILE_REDIRECT_URI, ...devRedirects], type: "public" });
  return clients;
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

/**
 * PKCE (RFC 7636, S256): the app sends sha256(verifier) with the authorization
 * request and the verifier itself when it redeems the code, so a code
 * intercepted on the way back to the phone is useless to anyone else.
 * Only S256 is accepted — "plain" would put the secret in the first request.
 */
export function isValidCodeChallenge(challenge: string, method: string): boolean {
  return method === "S256" && /^[A-Za-z0-9_-]{43}$/.test(challenge);
}

export function pkceMatches(challenge: string | null | undefined, verifier: string): boolean {
  if (!challenge || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  const computed = crypto.createHash("sha256").update(verifier).digest("base64url");
  return secretMatches(challenge, computed);
}
