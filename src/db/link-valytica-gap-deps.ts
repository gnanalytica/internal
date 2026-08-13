import { config } from "dotenv";
config({ path: ".env.local" });
import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { issueRelations, issues, projects } from "./schema";

/**
 * Wire the new compliance/gap/channel tickets into the plan they gate.
 * Convention matches the WBS load: issueId blocks relatedIssueId.
 * Re-runnable — clears these pairs first. Neon HTTP: sequential.
 */

/** [blocker, blocked, why] — a hard gate: the second cannot ship without the first. */
const BLOCKS: [string, string, string][] = [
  ["DPDP-01", "MC-05", "a bulk send needs a lawful basis and a working opt-out"],
  ["DPDP-01", "SAL-05", "calling the list is outreach to personal data"],
  ["GAP-03", "MC-05", "3,350 unverified addresses would burn the sending domain"],
  ["GAP-03", "MS-10", "the launch sequence includes the newsletter"],
  ["GAP-04", "SAL-05", "read the quality flag before personalising a message"],
  ["GAP-01", "SAL-07", "contacting 25+ valuers needs phone numbers; South India has 93"],
  ["CHN-01", "MS-09", "promoting a webinar needs a host who has agreed to it"],
];

/** [a, b] — same subject, no ordering implied. */
const RELATED: [string, string][] = [
  ["GAP-02", "GAP-01"],
  ["GAP-05", "GAP-01"],
  ["GAP-06", "GAP-04"],
  ["CHN-01", "MR-04"],
  ["CHN-01", "MR-05"],
  ["CHN-02", "SAL-08"],
];

async function main() {
  const [project] = await db.select().from(projects).where(eq(projects.key, "VAL"));
  if (!project) throw new Error("Valytica project not found");

  const rows = await db
    .select({ id: issues.id, number: issues.number, title: issues.title })
    .from(issues)
    .where(eq(issues.projectId, project.id));
  const byKey = new Map<string, { id: string; number: number }>();
  for (const r of rows) {
    const key = r.title.split(" · ")[0];
    // Parents only — sub-issues share the prefix with a dotted suffix.
    if (!key.includes(".")) byKey.set(key, { id: r.id, number: r.number });
  }

  const keys = new Set([...BLOCKS.flatMap(([a, b]) => [a, b]), ...RELATED.flat()]);
  const missing = [...keys].filter((k) => !byKey.has(k));
  if (missing.length) throw new Error(`tickets not found: ${missing.join(", ")}`);

  // Clear a prior run of exactly these pairs.
  const ids = [...keys].map((k) => byKey.get(k)!.id);
  await db.delete(issueRelations).where(sql`${issueRelations.issueId} in ${ids}`);

  for (const [from, to, why] of BLOCKS) {
    const a = byKey.get(from)!;
    const b = byKey.get(to)!;
    await db.insert(issueRelations).values({
      workspaceId: project.workspaceId,
      issueId: a.id,
      relatedIssueId: b.id,
      type: "blocks",
    });
    console.log(`  ${from} (VAL-${a.number}) blocks ${to} (VAL-${b.number}) — ${why}`);
  }
  for (const [from, to] of RELATED) {
    const a = byKey.get(from)!;
    const b = byKey.get(to)!;
    await db.insert(issueRelations).values({
      workspaceId: project.workspaceId,
      issueId: a.id,
      relatedIssueId: b.id,
      type: "related",
    });
    console.log(`  ${from} ↔ ${to}`);
  }
  console.log(`\n${BLOCKS.length} blocks · ${RELATED.length} related`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
