import { AccountSettings } from "@/components/settings/account-settings";
import { auth } from "@/lib/auth/server";
import { getCurrentUser, getWorkspace } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ws = await getWorkspace();
  const me = await getCurrentUser(ws.id);

  const res = await auth.listAccounts();
  const accounts = (res.data ?? []) as unknown as Array<{
    providerId?: string;
    provider?: string;
  }>;
  const providerIds = accounts
    .map((a) => a.providerId ?? a.provider)
    .filter((x): x is string => Boolean(x));

  return (
    <AccountSettings name={me.name} email={me.email} providerIds={providerIds} />
  );
}
