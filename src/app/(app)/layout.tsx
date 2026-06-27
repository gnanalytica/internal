import { AppShell } from "@/components/app-shell";
import { CommandPalette } from "@/components/command-palette";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { Sidebar } from "@/components/sidebar";
import { canSeeConfidential } from "@/lib/departments";
import {
  getCurrentUser,
  getFavorites,
  getLabels,
  getMembers,
  getMyRole,
  getMyWorkspaces,
  getPageTree,
  getProjects,
  getUnreadCount,
  getWorkspace,
} from "@/lib/data";

// Every page in this segment reads the current user's session and workspace
// data, so the whole authenticated app is rendered per-request. This also keeps
// `next build` from trying to statically prerender these pages (which would
// require auth/database access at build time).
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ws = await getWorkspace();
  const [members, me, projects, pageTree, labels, myWorkspaces, unreadCount, favorites, role] =
    await Promise.all([
      getMembers(ws.id),
      getCurrentUser(ws.id),
      getProjects(ws.id),
      getPageTree(ws.id),
      getLabels(ws.id),
      getMyWorkspaces(),
      getUnreadCount(ws.id),
      getFavorites(ws.id),
      getMyRole(ws.id),
    ]);
  const isAdmin = canSeeConfidential(role);
  // Hide confidential projects (Finance, People & HR) from members' sidebar.
  const visibleProjects = isAdmin ? projects : projects.filter((p) => !p.confidential);

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
            projects={visibleProjects}
            pageTree={pageTree}
            labels={labels}
            unreadCount={unreadCount}
            favorites={favorites}
            isAdmin={isAdmin}
          />
        }
      >
        {children}
      </AppShell>
      <CommandPalette isAdmin={isAdmin} />
      <KeyboardShortcuts projects={visibleProjects} members={members} labels={labels} />
    </div>
  );
}
