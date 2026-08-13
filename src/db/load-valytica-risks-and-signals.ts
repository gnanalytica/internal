import { config } from "dotenv";
config({ path: ".env.local" });
import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { cycles, feedback, issueLabels, issues, labels, projects, users } from "./schema";

/**
 * The two sections of the launch plan that stayed prose: the risk register and
 * the qualitative signals. A risk with no owner is a paragraph; a signal with
 * nowhere to record it is never recorded.
 *
 * Risks become tracked issues carrying their mitigation. Signals become
 * feedback entries, which is where AM-07's weekly sentiment reports accumulate.
 * Re-runnable. Neon HTTP: sequential.
 */

/** §7 of the MVP Launch Plan. Owner is who can actually act on it. */
const RISKS: { key: string; title: string; impact: string; mitigation: string; owner: string; priority: string; week: number }[] = [
  { key: "RSK-01", title: "Extraction tuning starts W2 instead of W1", impact: "Breaks the 4-week engineering envelope", mitigation: "The document corpus is a W1 deliverable with a named owner.", owner: "Raunak", priority: "urgent", week: 1 },
  { key: "RSK-02", title: "Real labelled documents never arrive", impact: "The 90% accuracy target is unverifiable", mitigation: "Source from valuers during early calls. Note the plan's own timing problem: calls begin after the corpus is due, so another source is needed.", owner: "Raunak", priority: "urgent", week: 1 },
  { key: "RSK-03", title: "State portals block or rate-limit automation", impact: "The verification step degrades", mitigation: "Manual-assisted fallback built in W3, not discovered in W5.", owner: "Harshith", priority: "high", week: 3 },
  { key: "RSK-04", title: "Sales ramps slowly", impact: "The 5-lead goal is missed", mitigation: "Lead list ready before calling starts; two days of training, then calls.", owner: "Shravani", priority: "high", week: 2 },
  { key: "RSK-05", title: "One QA week covers both functional and security", impact: "Defects escape into production", mitigation: "Test cases written in W4; W5 executes only.", owner: "Aparna", priority: "high", week: 4 },
  { key: "RSK-06", title: "Scope creep after the 20 Aug freeze", impact: "The launch date slips", mitigation: "All new asks route to the post-launch backlog through the Jay/Sandeep gate.", owner: "Jayasaagar", priority: "high", week: 1 },
  { key: "RSK-07", title: "Ganesh Chaturthi falls in launch week", impact: "Team and user availability", mitigation: "Verify the date and shift the launch if it collides. Flagged three times in the plan and still unowned.", owner: "Sandeep", priority: "urgent", week: 1 },
  { key: "RSK-08", title: "Marketing waits on LinkedIn automation", impact: "The campaign is delayed", mitigation: "Schedule manually from W2; automation is an enhancement, not a dependency.", owner: "Shravani", priority: "medium", week: 2 },
  { key: "RSK-09", title: "Two people carry both extraction and the app build", impact: "Serial work presented as parallel", mitigation: "Unresolved. The WBS names this the tightest resource risk and the schedule does not answer it.", owner: "Sandeep", priority: "urgent", week: 1 },
];

/** §6 — what to watch, where it comes from, and what healthy looks like. */
const SIGNALS: { title: string; source: string; healthy: string }[] = [
  { title: "Trust in AI extraction", source: "interview", healthy: '"I only correct 2–3 fields"' },
  { title: "Willingness to sign the report", source: "customer", healthy: "No hesitation, no Excel fallback" },
  { title: "Report credibility with banks", source: "customer", healthy: "Accepted without reformatting" },
  { title: "Onboarding clarity", source: "interview", healthy: "First report completed unaided" },
  { title: "Willingness to pay", source: "sales", healthy: "Asks about plans before being pitched" },
  { title: "Content resonance", source: "other", healthy: "Valuers reply with their own problems" },
  { title: "Team clarity", source: "internal", healthy: "Blockers raised early in the week, not at the review" },
];

async function main() {
  const [project] = await db.select().from(projects).where(eq(projects.key, "VAL"));
  if (!project) throw new Error("Valytica project not found");
  const ws = project.workspaceId;
  const people = await db.select({ id: users.id, name: users.name }).from(users);
  const userId = new Map(people.map((u) => [u.name, u.id]));
  const cyc = await db.select().from(cycles).where(eq(cycles.projectId, project.id));
  const cycleId = new Map(cyc.map((c) => [c.number, c.id]));

  // Label
  const existing = await db.select().from(labels).where(eq(labels.workspaceId, ws));
  let riskLabel = existing.find((l) => l.name === "risk")?.id;
  if (!riskLabel) {
    const [made] = await db
      .insert(labels)
      .values({ workspaceId: ws, name: "risk", color: "#eb5757" })
      .returning({ id: labels.id });
    riskLabel = made.id;
  }

  // Risks
  for (const r of RISKS)
    await db.delete(issues).where(sql`${issues.projectId} = ${project.id} and ${issues.title} like ${r.key + " ·%"}`);
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${issues.number}), 0)::int` })
    .from(issues)
    .where(eq(issues.projectId, project.id));
  let n = max;
  for (const r of RISKS) {
    const [made] = await db
      .insert(issues)
      .values({
        workspaceId: ws,
        projectId: project.id,
        number: ++n,
        title: `${r.key} · ${r.title}`,
        type: "ops",
        status: "todo",
        priority: r.priority,
        cycleId: cycleId.get(r.week) ?? null,
        assigneeId: userId.get(r.owner) ?? null,
        creatorId: userId.get("Sandeep") ?? null,
        description: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: `Impact — ${r.impact}` }] },
            { type: "paragraph", content: [{ type: "text", text: `Mitigation — ${r.mitigation}` }] },
          ],
        },
        sortKey: `c${String(n).padStart(4, "0")}`,
      })
      .returning({ id: issues.id });
    await db.insert(issueLabels).values({ issueId: made.id, labelId: riskLabel });
    console.log(`  VAL-${n}  ${r.key}  ${r.priority.padEnd(6)} ${r.owner}`);
  }

  // Signals
  await db.delete(feedback).where(eq(feedback.projectId, project.id));
  await db.insert(feedback).values(
    SIGNALS.map((s, i) => ({
      workspaceId: ws,
      projectId: project.id,
      title: s.title,
      body: `Healthy looks like: ${s.healthy}`,
      source: s.source,
      status: "new",
      votes: 0,
      sortKey: `a${String(i).padStart(3, "0")}`,
    })),
  );
  console.log(`\nrisks   ${RISKS.length} tracked · signals ${SIGNALS.length} in feedback`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
