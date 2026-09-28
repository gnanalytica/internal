"use server";

import { redirect } from "next/navigation";

import { getCurrentUser, getMyWorkspaces } from "@/lib/data";
import { findClient, isValidCodeChallenge, issueCode, purgeExpiredCodes, redirectUriAllowed } from "@/lib/api/oauth";

/**
 * Approve a connection request and hand the client an authorization code.
 *
 * Everything is re-validated here. The consent page already checked the client,
 * the redirect and the caller's role, but that ran in a different request — a
 * form post can carry any values, so trusting the page's checks would let
 * someone approve a connection for a workspace they do not administer.
 */
export async function approveConnection(formData: FormData): Promise<void> {
  const clientId = String(formData.get("client_id") ?? "");
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const state = String(formData.get("state") ?? "");
  const workspaceId = String(formData.get("workspace_id") ?? "");
  const codeChallenge = String(formData.get("code_challenge") ?? "");
  const challengeMethod = String(formData.get("code_challenge_method") ?? "");

  const client = findClient(clientId);
  if (!client || !redirectUriAllowed(client, redirectUri)) {
    // Never bounce to an unvalidated redirect_uri — that is how an open
    // redirector becomes a code-stealing gadget.
    throw new Error("invalid_client");
  }

  const me = await getCurrentUser();
  const mine = await getMyWorkspaces();
  const ws = mine.find((w) => w.id === workspaceId);
  // Connecting an integration hands out admin rights, so only an admin may. The
  // mobile app acts as the member themself, so any member may sign in to it.
  if (!ws || (client.type === "confidential" && ws.role !== "admin")) throw new Error("forbidden");
  if (client.type === "public" && !isValidCodeChallenge(codeChallenge, challengeMethod)) throw new Error("invalid_request");

  const code = await issueCode({
    clientId,
    redirectUri,
    workspaceId: ws.id,
    userId: me.id,
    codeChallenge: client.type === "public" ? codeChallenge : null,
  });

  // Housekeeping on a path that already touches the table, so expired codes do
  // not accumulate and no cron is needed for a table this small.
  try {
    await purgeExpiredCodes();
  } catch {
    // Never fail an approval over cleanup.
  }

  const target = new URL(redirectUri);
  target.searchParams.set("code", code);
  if (state) target.searchParams.set("state", state);
  redirect(target.toString());
}
