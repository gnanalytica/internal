import crypto from "node:crypto";

/** SHA-256 hash of an API key (only the hash is stored). */
export function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/** Mint a new API key. Returns the plaintext (shown once), its hash, and a
 *  display prefix. Format: `int_<base64url>`. */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw = crypto.randomBytes(24).toString("base64url");
  const key = `int_${raw}`;
  return { key, hash: hashKey(key), prefix: key.slice(0, 12) };
}
