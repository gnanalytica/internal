import { InboxView } from "@/components/inbox-view";
import { getNotifications, getWorkspace } from "@/lib/data";

export default async function InboxPage() {
  const ws = await getWorkspace();
  const notifications = await getNotifications(ws.id);
  return <InboxView notifications={notifications} />;
}
