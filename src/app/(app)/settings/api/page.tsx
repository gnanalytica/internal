import { ApiKeysView } from "@/components/api-keys-view";
import { getApiKeys, getMyRole, getWebhooks, getWorkspace } from "@/lib/data";
import { WEBHOOK_EVENTS } from "@/lib/api/webhooks";

export const dynamic = "force-dynamic";

export default async function ApiSettingsPage() {
  const ws = await getWorkspace();
  const [role, keys, webhooks] = await Promise.all([
    getMyRole(ws.id),
    getApiKeys(ws.id),
    getWebhooks(ws.id),
  ]);
  const base = process.env.NEXT_PUBLIC_APP_URL || "";
  return (
    <ApiKeysView
      keys={keys}
      webhooks={webhooks}
      events={[...WEBHOOK_EVENTS]}
      isAdmin={role === "admin"}
      baseUrl={base}
    />
  );
}
