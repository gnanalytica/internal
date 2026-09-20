
import { createSign } from "node:crypto";

/**
 * Service-account access tokens for the Google Sheets API, without the
 * `googleapis` package (which is ~100 MB and needs none of its surface here).
 * A signed JWT is exchanged at the token endpoint; the token is cached until
 * a minute before it expires.
 *
 * Env: GOOGLE_SA_EMAIL, GOOGLE_SA_PRIVATE_KEY (PEM; `\n` escapes and CRLF are
 * both normalised), VALYTICA_CRM_SHEET_ID.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

export function isSheetSyncConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SA_EMAIL && process.env.GOOGLE_SA_PRIVATE_KEY && process.env.VALYTICA_CRM_SHEET_ID,
  );
}

export function sheetId(): string {
  const id = process.env.VALYTICA_CRM_SHEET_ID;
  if (!id) throw new Error("VALYTICA_CRM_SHEET_ID is not set.");
  return id;
}

/**
 * The service-account PEM, from an env var that people paste by hand.
 *
 * Every way of copying it out of the JSON key file produces something
 * slightly different — the JSON value carries literal `\n` escapes, a
 * dashboard paste keeps real newlines, and copying the raw JSON line brings
 * the surrounding quotes with it. All three are accepted. Anything that is
 * still not a PEM afterwards is named explicitly, because OpenSSL's own
 * error for it ("DECODER routines::unsupported") says nothing useful.
 */
function privateKey(): string {
  let raw = (process.env.GOOGLE_SA_PRIVATE_KEY ?? "").trim();
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1);
  }
  const key = raw.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();
  if (!key) throw new Error("GOOGLE_SA_PRIVATE_KEY is empty.");
  if (!key.includes("-----BEGIN") || !key.includes("PRIVATE KEY-----")) {
    throw new Error(
      "GOOGLE_SA_PRIVATE_KEY does not look like a PEM. Copy the whole `private_key` value out of the service account's JSON key file, including the -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY----- lines.",
    );
  }
  return key.endsWith("\n") ? key : `${key}\n`;
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

let cached: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const email = process.env.GOOGLE_SA_EMAIL;
  if (!email || !process.env.GOOGLE_SA_PRIVATE_KEY) {
    throw new Error("Google service account is not configured (GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY).");
  }
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }),
  );
  // Resolved before the try, so its own (specific) message is not swallowed
  // by the generic one below.
  const pem = privateKey();
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  let signature: string;
  try {
    signature = signer.sign(pem).toString("base64url");
  } catch (err) {
    // OpenSSL says "DECODER routines::unsupported" for anything it cannot
    // parse, which reads as a platform fault rather than a bad paste.
    throw new Error(
      `GOOGLE_SA_PRIVATE_KEY could not be parsed as an RSA private key (${err instanceof Error ? err.message : String(err)}). It is almost always a copy/paste problem: the value must be the service account JSON's \`private_key\`, with its BEGIN/END lines, and either real newlines or \\n escapes.`,
    );
  }
  const assertion = `${header}.${claims}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cached.token;
}
