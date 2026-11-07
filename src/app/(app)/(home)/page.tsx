import { MyWorkView, type MyProject } from "@/components/my-work-view";
import { canSeeConfidential } from "@/lib/departments";
import {
  getCurrentUser,
  getIssues,
  getMyRole,
  getNotifications,
  getPortfolio,
  getUnreadCount,
  getWorkspace,
} from "@/lib/data";
import { getTaskContext } from "@/lib/task-context";

/**
 * Home is your own work: what's assigned to you, bucketed by when it's due,
 * beside what's waiting on you. The company portfolio that used to live here
 * is now the Projects page, alongside the timeline and the weekly rollup.
 */
export default async function HomePage() {
  const ws = await getWorkspace();
  const [me, allIssues, ctx, notifications, unreadCount, portfolio, role] = await Promise.all([
    getCurrentUser(ws.id),
    getIssues(ws.id),
    getTaskContext(ws.id),
    getNotifications(ws.id),
    getUnreadCount(ws.id),
    getPortfolio(ws.id),
    getMyRole(ws.id),
  ]);

  // Where I'm the primary assignee or one of the co-assignees (as My tasks).
  const mine = allIssues.filter(
    (i) => i.assigneeId === me.id || i.assignees.some((a) => a.id === me.id),
  );

  // Projects I lead or have open work in, lead first, then most of my work.
  const isAdmin = canSeeConfidential(role);
  const openMine = new Map<string, number>();
  for (const i of mine) {
    if (i.projectId && i.status !== "done" && i.status !== "canceled") {
      openMine.set(i.projectId, (openMine.get(i.projectId) ?? 0) + 1);
    }
  }
  const myProjects: MyProject[] = ctx.projects
    .filter((p) => isAdmin || !p.confidential)
    .filter((p) => p.ownerId === me.id || openMine.has(p.id))
    .map((p) => {
      const row = portfolio.find((r) => r.id === p.id);
      return {
        id: p.id,
        name: p.name,
        key: p.key,
        color: p.color,
        health: row?.health ?? "none",
        done: row?.doneIssues ?? 0,
        total: row?.totalIssues ?? 0,
        mine: openMine.get(p.id) ?? 0,
        lead: p.ownerId === me.id,
      };
    })
    .sort((a, b) => Number(b.lead) - Number(a.lead) || b.mine - a.mine)
    .slice(0, 6);

  // Unread first, then the latest — five is a glance, the inbox is the list.
  const glance = [...notifications]
    .sort((a, b) => Number(Boolean(a.read)) - Number(Boolean(b.read)))
    .slice(0, 5);

  return (
    <MyWorkView
      issues={mine}
      nowISO={new Date().toISOString()}
      members={ctx.members}
      projects={ctx.projects}
      labels={ctx.labels}
      notifications={glance}
      unreadCount={unreadCount}
      myProjects={myProjects}
      bets={(ws.bets ?? []).filter(Boolean)}
    />
  );
}
