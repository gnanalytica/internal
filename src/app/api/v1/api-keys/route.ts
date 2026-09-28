import { ok, readJson, withAdminApiAuth } from "@/lib/api/http";
import { apiCreateApiKey, apiListApiKeys } from "@/lib/api/settings-ops";

/**
 * The workspace's API keys: integration keys made in Settings (`kind: "key"`)
 * and mobile-app sign-ins (`kind: "app"`). Name, prefix, who made it and when
 * it was last used — never the key or its hash. Admins only.
 */
export const GET = withAdminApiAuth(async (_req, auth) => {
  const keys = await apiListApiKeys(auth.workspaceId, auth.keyId);
  return ok({ data: keys, count: keys.length });
});

/**
 * Mint an integration key: `{ name }`. The response carries the full key
 * exactly once — it is not stored and cannot be shown again. Admins only.
 */
export const POST = withAdminApiAuth(async (req, auth) => {
  const { name } = await readJson<{ name?: unknown }>(req);
  const created = await apiCreateApiKey(auth.workspaceId, auth.userId, name);
  return ok({ data: created }, 201);
});
