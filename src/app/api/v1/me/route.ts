import { eq } from "drizzle-orm";

import { db } from "@/db";
import { apiKeys, users, workspaces } from "@/db/schema";
import { apiError, ok, withApiAuth } from "@/lib/api/http";

export const GET = withApiAuth(async (_req, auth) => {
  const [ws] = await db
    .select({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.id, auth.workspaceId))
    .limit(1);

  // Writes are attributed to the member who created the key — surface that so
  // an agent can say who it is acting as before it changes anything.
  const [actor] = auth.userId
    ? await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, auth.userId))
        .limit(1)
    : [];

  const [key] = await db
    .select({ name: apiKeys.name, prefix: apiKeys.keyPrefix })
    .from(apiKeys)
    .where(eq(apiKeys.id, auth.keyId))
    .limit(1);

  return ok({
    workspace: ws ?? null,
    actor: actor ?? null,
    key: key ?? null,
    isAdmin: auth.isAdmin,
  });
});

/**
 * Sign out of the mobile app: the app's key revokes itself, so a lost or
 * handed-on phone keeps nothing. Refused for Settings-made integration keys,
 * which an admin revokes from Settings rather than by a stray call.
 */
export const DELETE = withApiAuth(async (_req, auth) => {
  if (auth.kind !== "app") return apiError("Only a mobile-app sign-in can revoke itself. Revoke integration keys from Settings → API.", 400);
  await db.delete(apiKeys).where(eq(apiKeys.id, auth.keyId));
  return ok({ signedOut: true });
});
