import { eq } from "drizzle-orm";

import { db } from "@/db";
import { apiKeys, workspaces } from "@/db/schema";
import { apiError, ok } from "@/lib/api/http";
import { generateApiKey } from "@/lib/api/keys";
import { findClient, redeemCode, redirectUriAllowed, secretMatches } from "@/lib/api/oauth";

/**
 * OAuth2 token endpoint — exchange an authorization code for a workspace API key.
 *
 * NOT behind `withApiAuth`: the caller has no key yet, that is the whole point.
 * The client authenticates with its own id + secret instead, which is why the
 * client must be confidential (a server, never a browser).
 *
 * The "access token" we return is an ordinary workspace API key, so everything
 * downstream — auth, scoping, revocation from the settings UI — is the exact
 * mechanism a hand-made key already uses. No parallel token type to secure,
 * expire or audit separately.
 */
export async function POST(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/x-www-form-urlencoded")) {
      body = Object.fromEntries(new URLSearchParams(await req.text()));
    } else {
      body = (await req.json()) as Record<string, unknown>;
    }
  } catch {
    return apiError("invalid_request", 400);
  }

  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "");
  const grantType = str("grant_type");
  const code = str("code");
  const clientId = str("client_id");
  const clientSecret = str("client_secret");
  const redirectUri = str("redirect_uri");

  if (grantType !== "authorization_code") return apiError("unsupported_grant_type", 400);

  // One generic failure for every client-auth problem — unknown id, wrong
  // secret, unregistered redirect. Distinguishing them would let a caller probe
  // which client ids exist.
  const client = findClient(clientId);
  if (!client || !secretMatches(client.secret, clientSecret)) {
    return apiError("invalid_client", 401);
  }
  if (!redirectUriAllowed(client, redirectUri)) return apiError("invalid_client", 401);

  const redeemed = await redeemCode({ code, clientId, redirectUri });
  if (!redeemed) return apiError("invalid_grant", 400);

  const [ws] = await db
    .select({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.id, redeemed.workspaceId))
    .limit(1);
  if (!ws) return apiError("invalid_grant", 400);

  // Mint the key against the approving human, so the settings list shows who
  // authorised the connection rather than an anonymous integration row.
  const { key, hash, prefix } = generateApiKey();
  await db.insert(apiKeys).values({
    workspaceId: ws.id,
    name: client.name,
    keyHash: hash,
    keyPrefix: prefix,
    createdBy: redeemed.userId,
  });

  return ok({
    access_token: key,
    token_type: "Bearer",
    workspace: { id: ws.id, name: ws.name, slug: ws.slug },
  });
}
