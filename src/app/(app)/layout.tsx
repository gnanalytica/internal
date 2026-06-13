import { Sidebar } from "@/components/sidebar";
import {
  getCurrentUser,
  getLabels,
  getMembers,
  getPageTree,
  getProjects,
  getWorkspace,
} from "@/lib/data";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ws = await getWorkspace();
  const [members, me, projects, pageTree, labels] = await Promise.all([
    getMembers(ws.id),
    getCurrentUser(ws.id),
    getProjects(ws.id),
    getPageTree(ws.id),
    getLabels(ws.id),
  ]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        workspace={ws}
        members={members}
        currentUser={me}
        projects={projects}
        pageTree={pageTree}
        labels={labels}
      />
      <main className="flex-1 min-w-0 overflow-hidden">{children}</main>
    </div>
  );
}
