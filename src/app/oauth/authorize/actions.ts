"use server";

import { redirect } from "next/navigation";

import { getCurrentUser, getMyWorkspaces } from "@/lib/data";
import { findClient, issueCode, purgeExpiredCodes, redirectUriAllowed } from "@/lib/api/oauth";

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

  const client = findClient(clientId);
  if (!client || !redirectUriAllowed(client, redirectUri)) {
    // Never bounce to an unvalidated redirect_uri — that is how an open
    // redirector becomes a code-stealing gadget.
    throw new Error("invalid_client");
  }

  const me = await getCurrentUser();
  const mine = await getMyWorkspaces();
  const ws = mine.find((w) => w.id === workspaceId);
  if (!ws || ws.role !== "admin") throw new Error("forbidden");

  const code = await issueCode({
    clientId,
    redirectUri,
    workspaceId: ws.id,
    userId: me.id,
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
