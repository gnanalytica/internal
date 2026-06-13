import { ApiKeysView } from "@/components/api-keys-view";
import { getApiKeys, getMyRole, getWorkspace } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ApiSettingsPage() {
  const ws = await getWorkspace();
  const [role, keys] = await Promise.all([getMyRole(ws.id), getApiKeys(ws.id)]);
  const base = process.env.NEXT_PUBLIC_APP_URL || "";
  return <ApiKeysView keys={keys} isAdmin={role === "admin"} baseUrl={base} />;
}
