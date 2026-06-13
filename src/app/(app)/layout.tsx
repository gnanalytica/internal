import { AppShell } from "@/components/app-shell";
import { CommandPalette } from "@/components/command-palette";
import { Sidebar } from "@/components/sidebar";
import {
  getCurrentUser,
  getFavorites,
  getLabels,
  getMembers,
  getMyWorkspaces,
  getPageTree,
  getProjects,
  getUnreadCount,
  getWorkspace,
} from "@/lib/data";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ws = await getWorkspace();
  const [members, me, projects, pageTree, labels, myWorkspaces, unreadCount, favorites] =
    await Promise.all([
      getMembers(ws.id),
      getCurrentUser(ws.id),
      getProjects(ws.id),
      getPageTree(ws.id),
      getLabels(ws.id),
      getMyWorkspaces(),
      getUnreadCount(ws.id),
      getFavorites(ws.id),
    ]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppShell
        workspaceName={ws.name}
        sidebar={
          <Sidebar
            workspace={ws}
            workspaces={myWorkspaces}
            members={members}
            currentUser={me}
            projects={projects}
            pageTree={pageTree}
            labels={labels}
            unreadCount={unreadCount}
            favorites={favorites}
          />
        }
      >
        {children}
      </AppShell>
      <CommandPalette />
    </div>
  );
}
