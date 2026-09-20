import "server-only";

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Per-user Google OAuth for Gmail + Calendar. A Google Workspace "internal"
 * OAuth client, so no verification review. Refresh tokens are encrypted at
 * rest with AES-256-GCM under GOOGLE_TOKEN_ENC_KEY (32 bytes, base64).
 *
 * Env: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_TOKEN_ENC_KEY.
 * Redirect URI: <APP_BASE_URL>/api/google/callback.
 */

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET && process.env.GOOGLE_TOKEN_ENC_KEY);
}

function encKey(): Buffer {
  const raw = process.env.GOOGLE_TOKEN_ENC_KEY ?? "";
  const buf = Buffer.from(raw, "base64");
  // Accept any secret; derive 32 bytes so a passphrase works too.
  return buf.length === 32 ? buf : createHash("sha256").update(raw).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptSecret(blob: string): string {
  const [iv, tag, enc] = blob.split(".");
  const decipher = createDecipheriv("aes-256-gcm", encKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(enc, "base64url")), decipher.final()]).toString("utf8");
}

export function redirectUri(baseUrl: string): string {
  return `${baseUrl}/api/google/callback`;
}

/** State = userId + HMAC, so the callback cannot be pointed at another user. */
export function signState(userId: string): string {
  const mac = createHmac("sha256", encKey()).update(userId).digest("base64url");
  return `${userId}.${mac}`;
}

export function verifyState(state: string | null): string | null {
  if (!state) return null;
  const [userId, mac] = state.split(".");
  if (!userId || !mac) return null;
  const expect = createHmac("sha256", encKey()).update(userId).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expect);
  return a.length === b.length && timingSafeEqual(a, b) ? userId : null;
}

export function authUrl(baseUrl: string, userId: string): string {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri: redirectUri(baseUrl),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: signState(userId),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string; scope?: string };

export async function exchangeCode(baseUrl: string, code: string): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirect_uri: redirectUri(baseUrl),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google code exchange failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as TokenResponse;
}

export async function refreshAccessToken(refreshToken: string): Promise<{ token: string; expiresAt: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google refresh failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  return { token: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 };
}

export async function userEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`userinfo failed: ${res.status}`);
  return ((await res.json()) as { email: string }).email;
}
