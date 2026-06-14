import { notFound } from "next/navigation";

import { AccountDetail } from "@/components/account-detail";
import { getAccount, getMembers, getWorkspace } from "@/lib/data";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const [account, members] = await Promise.all([
    getAccount(ws.id, id),
    getMembers(ws.id),
  ]);
  if (!account) notFound();

  return <AccountDetail account={account} members={members} />;
}
