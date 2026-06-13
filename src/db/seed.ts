import { config } from "dotenv";

config({ path: ".env.local" });

import { db, schema } from "./index";

/** Minimal TipTap doc helper. */
function doc(...paragraphs: string[]) {
  return {
    type: "doc",
    content: paragraphs.map((text) => ({
      type: "paragraph",
      content: text ? [{ type: "text", text }] : [],
    })),
  };
}

async function main() {
  console.log("Seeding database…");

  // Clean slate (dev only) — order respects FKs via cascade.
  await db.delete(schema.issuePageLinks);
  await db.delete(schema.issueLabels);
  await db.delete(schema.issues);
  await db.delete(schema.pages);
  await db.delete(schema.labels);
  await db.delete(schema.projects);
  await db.delete(schema.workspaceMembers);
  await db.delete(schema.users);
  await db.delete(schema.workspaces);

  const [ws] = await db
    .insert(schema.workspaces)
    .values({ name: "Acme", slug: "acme" })
    .returning();

  const [sandeep, alex, mia] = await db
    .insert(schema.users)
    .values([
      { name: "Sandeep", email: "sandeep@gnanalytica.com", avatarColor: "#6366f1" },
      { name: "Alex Rivera", email: "alex@acme.test", avatarColor: "#ec4899" },
      { name: "Mia Chen", email: "mia@acme.test", avatarColor: "#10b981" },
    ])
    .returning();

  await db.insert(schema.workspaceMembers).values([
    { workspaceId: ws.id, userId: sandeep.id, role: "admin" },
    { workspaceId: ws.id, userId: alex.id, role: "member" },
    { workspaceId: ws.id, userId: mia.id, role: "member" },
  ]);

  const [eng, design] = await db
    .insert(schema.projects)
    .values([
      { workspaceId: ws.id, name: "Engineering", key: "ENG", color: "#6366f1" },
      { workspaceId: ws.id, name: "Design", key: "DES", color: "#ec4899" },
    ])
    .returning();

  const [bug, feature, improvement] = await db
    .insert(schema.labels)
    .values([
      { workspaceId: ws.id, name: "Bug", color: "#ef4444" },
      { workspaceId: ws.id, name: "Feature", color: "#3b82f6" },
      { workspaceId: ws.id, name: "Improvement", color: "#a855f7" },
    ])
    .returning();

  const issueRows = [
    { project: eng, title: "Set up CI pipeline", status: "in_progress", priority: "high", assignee: sandeep },
    { project: eng, title: "Fix flaky auth test", status: "todo", priority: "urgent", assignee: alex },
    { project: eng, title: "Add dark mode toggle", status: "backlog", priority: "medium", assignee: mia },
    { project: eng, title: "Migrate to Drizzle ORM", status: "done", priority: "high", assignee: sandeep },
    { project: design, title: "Design issue board columns", status: "in_review", priority: "medium", assignee: mia },
    { project: design, title: "New empty-state illustrations", status: "backlog", priority: "low", assignee: alex },
  ];

  let n = { ENG: 0, DES: 0 } as Record<string, number>;
  const createdIssues = [];
  for (let i = 0; i < issueRows.length; i++) {
    const r = issueRows[i];
    n[r.project.key] += 1;
    const [issue] = await db
      .insert(schema.issues)
      .values({
        workspaceId: ws.id,
        projectId: r.project.id,
        number: n[r.project.key],
        title: r.title,
        description: doc(`Details for "${r.title}".`),
        status: r.status,
        priority: r.priority,
        assigneeId: r.assignee.id,
        creatorId: sandeep.id,
        sortKey: `a${i}`,
      })
      .returning();
    createdIssues.push(issue);
  }

  await db.insert(schema.issueLabels).values([
    { issueId: createdIssues[0].id, labelId: feature.id },
    { issueId: createdIssues[1].id, labelId: bug.id },
    { issueId: createdIssues[2].id, labelId: improvement.id },
  ]);

  const [welcome] = await db
    .insert(schema.pages)
    .values({
      workspaceId: ws.id,
      title: "Welcome to Acme",
      icon: "👋",
      content: doc(
        "This is your combined docs + issues workspace.",
        "Use the sidebar to navigate pages and issues.",
      ),
      position: "a0",
      creatorId: sandeep.id,
    })
    .returning();

  const [engWiki] = await db
    .insert(schema.pages)
    .values({
      workspaceId: ws.id,
      title: "Engineering Wiki",
      icon: "🛠️",
      content: doc("Engineering docs live here."),
      position: "a1",
      creatorId: sandeep.id,
    })
    .returning();

  await db.insert(schema.pages).values([
    {
      workspaceId: ws.id,
      parentId: engWiki.id,
      title: "Onboarding",
      icon: "🚀",
      content: doc("How to get set up as a new engineer."),
      position: "a0",
      creatorId: sandeep.id,
    },
    {
      workspaceId: ws.id,
      parentId: engWiki.id,
      title: "Architecture",
      icon: "🏗️",
      content: doc("System architecture overview."),
      position: "a1",
      creatorId: sandeep.id,
    },
  ]);

  // Link the CI issue to the Onboarding-adjacent wiki page.
  await db.insert(schema.issuePageLinks).values({
    issueId: createdIssues[0].id,
    pageId: engWiki.id,
  });

  console.log("Seed complete:", {
    workspace: ws.slug,
    users: 3,
    projects: 2,
    issues: createdIssues.length,
    pages: 4,
  });
  void welcome;
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
