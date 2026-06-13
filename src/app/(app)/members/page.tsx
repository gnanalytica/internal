import { MembersView } from "@/components/members-view";
import {
  getCurrentUser,
  getMembersWithRole,
  getMyRole,
  getWorkspace,
} from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const ws = await getWorkspace();
  const [members, me, role] = await Promise.all([
    getMembersWithRole(ws.id),
    getCurrentUser(ws.id),
    getMyRole(ws.id),
  ]);

  return (
    <MembersView
      members={members}
      currentUserId={me.id}
      isAdmin={role === "admin"}
    />
  );
}
