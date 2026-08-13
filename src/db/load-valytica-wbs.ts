import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "node:fs";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "./index";
import {
  projects, issues, cycles, milestones, labels, issueLabels, issueAssignees,
  issueRelations, users,
} from "./schema";

/**
 * Load the Valytica MVP WBS (Valytica_MVP_Detailed_WBS.xlsx) into the hub.
 * Re-runnable: clears the project's issues/cycles/milestones first, then loads.
 * Neon HTTP — no transactions, so every step is sequential and self-contained.
 */
const DATA = process.argv[2];
if (!DATA) throw new Error("usage: tsx load-valytica-wbs.ts <wbs.json>");

type Task = {
  id: string; parent: string | null; level: "Parent" | "Sub"; title: string;
  owners: string[]; track: string; type: string; label: string; week: string;
  dueRaw: string; due: string | null; priority: string; estimate: number | null;
  dependsOn: string[]; dod: string;
};

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

async function main() {
  const data = JSON.parse(readFileSync(DATA, "utf8")) as {
    tasks: Task[];
    cycles: { name: string; number: number; start: string; end: string }[];
    weekToCycle: Record<string, number>;
    milestones: { name: string; date: string; tickets: string[] }[];
    labels: string[];
  };

  const [project] = await db.select().from(projects).where(eq(projects.key, "VAL"));
  if (!project) throw new Error("Valytica project not found");
  const ws = project.workspaceId;
  const people = await db.select({ id: users.id, name: users.name }).from(users);
  const userId = new Map(people.map((u) => [u.name, u.id]));

  // 1. Departments — the functional set the WBS actually uses.
  await db
    .update(projects)
    .set({ enabledDepartments: ["product", "engineering", "marketing", "sales", "customer-success", "analytics"] })
    .where(eq(projects.id, project.id));
  console.log("departments  product · engineering · marketing · sales · customer-success · analytics");

  // 2. Clear prior load (project is otherwise empty; children cascade).
  await db.delete(issues).where(eq(issues.projectId, project.id));
  await db.delete(cycles).where(eq(cycles.projectId, project.id));
  await db.delete(milestones).where(eq(milestones.projectId, project.id));

  // 3. Labels — workspace-scoped, so reuse by name.
  const existing = await db.select().from(labels).where(eq(labels.workspaceId, ws));
  const labelId = new Map(existing.map((l) => [l.name, l.id]));
  const missing = data.labels.filter((n) => !labelId.has(n));
  if (missing.length) {
    const made = await db
      .insert(labels)
      .values(missing.map((name) => ({ workspaceId: ws, name })))
      .returning({ id: labels.id, name: labels.name });
    for (const l of made) labelId.set(l.name, l.id);
  }
  console.log(`labels       ${data.labels.length} (${missing.length} new)`);

  // 4. Cycles.
  const madeCycles = await db
    .insert(cycles)
    .values(data.cycles.map((c) => ({
      workspaceId: ws, projectId: project.id, name: c.name, number: c.number,
      startDate: at(c.start), endDate: at(c.end),
    })))
    .returning({ id: cycles.id, number: cycles.number });
  const cycleId = new Map(madeCycles.map((c) => [c.number, c.id]));
  console.log(`cycles       ${madeCycles.length}`);

  // 5. Milestones.
  const madeMilestones = await db
    .insert(milestones)
    .values(data.milestones.map((m, i) => ({
      workspaceId: ws, projectId: project.id, name: m.name,
      targetDate: at(m.date), sortKey: `a${String(i).padStart(3, "0")}`,
      description: m.tickets.length ? `Delivered by: ${m.tickets.join(", ")}` : null,
    })))
    .returning({ id: milestones.id, name: milestones.name });
  const msByName = new Map(madeMilestones.map((m) => [m.name, m.id]));
  const msForTicket = new Map<string, string>();
  for (const m of data.milestones)
    for (const t of m.tickets) msForTicket.set(t, msByName.get(m.name)!);
  console.log(`milestones   ${madeMilestones.length}`);

  // 6. Issues — parents first so sub-issues can point at a real parentId.
  const parents = data.tasks.filter((t) => t.level === "Parent");
  const subs = data.tasks.filter((t) => t.level === "Sub");
  const idOf = new Map<string, string>();
  let n = 0;

  const rowFor = (t: Task, parentId: string | null) => ({
    workspaceId: ws,
    projectId: project.id,
    parentId,
    number: ++n,
    title: `${t.id} · ${t.title}`,
    type: t.type,
    status: "todo",
    priority: t.priority,
    estimate: t.estimate,
    dueDate: t.due ? at(t.due) : null,
    cycleId: cycleId.get(data.weekToCycle[t.week]) ?? null,
    milestoneId: parentId ? null : (msForTicket.get(t.id) ?? null),
    assigneeId: t.owners.length ? (userId.get(t.owners[0]) ?? null) : null,
    creatorId: userId.get("Sandeep") ?? null,
    description: t.dod
      ? { type: "doc", content: [
          { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Definition of Done" }] },
          { type: "paragraph", content: [{ type: "text", text: t.dod }] },
          { type: "paragraph", content: [{ type: "text", text: `Track: ${t.track} · Week: ${t.week} · Due: ${t.dueRaw}` }] },
        ] }
      : null,
    sortKey: `a${String(n).padStart(4, "0")}`,
  });

  const insertChunked = async (tasks: Task[], parentOf: (t: Task) => string | null) => {
    for (let i = 0; i < tasks.length; i += 40) {
      const chunk = tasks.slice(i, i + 40);
      const made = await db
        .insert(issues)
        .values(chunk.map((t) => rowFor(t, parentOf(t))))
        .returning({ id: issues.id, title: issues.title });
      for (const r of made) idOf.set(r.title.split(" · ")[0], r.id);
    }
  };

  await insertChunked(parents, () => null);
  await insertChunked(subs, (t) => idOf.get(t.parent!) ?? null);
  console.log(`issues       ${parents.length} parents + ${subs.length} sub-issues = ${idOf.size}`);

  // 7. Labels + assignees.
  const labelRows = data.tasks
    .filter((t) => idOf.has(t.id) && labelId.has(t.label))
    .map((t) => ({ issueId: idOf.get(t.id)!, labelId: labelId.get(t.label)! }));
  for (let i = 0; i < labelRows.length; i += 100)
    await db.insert(issueLabels).values(labelRows.slice(i, i + 100)).onConflictDoNothing();

  const assigneeRows = data.tasks.flatMap((t) =>
    t.owners
      .filter((o) => userId.has(o) && idOf.has(t.id))
      .map((o) => ({ issueId: idOf.get(t.id)!, userId: userId.get(o)! })),
  );
  for (let i = 0; i < assigneeRows.length; i += 100)
    await db.insert(issueAssignees).values(assigneeRows.slice(i, i + 100)).onConflictDoNothing();
  console.log(`links        ${labelRows.length} labels · ${assigneeRows.length} assignees`);

  // 8. Dependencies: "A depends on B" => B blocks A.
  const relRows = data.tasks.flatMap((t) =>
    t.dependsOn
      .filter((d) => idOf.has(d) && idOf.has(t.id))
      .map((d) => ({ workspaceId: ws, issueId: idOf.get(d)!, relatedIssueId: idOf.get(t.id)!, type: "blocks" })),
  );
  const dropped = data.tasks.flatMap((t) => t.dependsOn.filter((d) => !idOf.has(d)));
  for (let i = 0; i < relRows.length; i += 100)
    await db.insert(issueRelations).values(relRows.slice(i, i + 100));
  console.log(`dependencies ${relRows.length} blocks-links${dropped.length ? ` (unresolved: ${[...new Set(dropped)].join(", ")})` : ""}`);

  const [{ c }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(issues)
    .where(eq(issues.projectId, project.id));
  console.log(`\nVAL now holds ${c} issues.`);
  void inArray;
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
