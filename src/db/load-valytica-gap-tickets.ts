import { config } from "dotenv";
config({ path: ".env.local" });
import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { cycles, issueLabels, issues, labels, projects, users } from "./schema";

/**
 * The actions the lead database and its README call for, which existed only as
 * spreadsheet rows: DPDP compliance, the six open "Gaps & Next Steps" items,
 * and the researched-but-unactioned channel plays.
 * Re-runnable: replaces any prior run by title prefix. Neon HTTP: sequential.
 */

type Seed = {
  key: string;
  title: string;
  body: string[];
  owner: string;
  type: string;
  priority: string;
  label: string;
  week: number; // cycle number
};

const SEEDS: Seed[] = [
  {
    key: "DPDP-01",
    title: "Establish the DPDP basis for outreach and stored personal data",
    owner: "Sandeep",
    type: "legal",
    priority: "urgent",
    label: "compliance",
    week: 1,
    body: [
      "The workspace now holds contact data for 508 identifiable people, and DPDP appears on the product roadmap with no ticket behind it.",
      'The lead database README states the position: "All data was collected from publicly published registers and panel lists. Under India\'s DPDP Act 2023 you still need a lawful basis for outreach — B2B professional contact for a legitimate business purpose is the usual one. Include an opt-out in every message and honour it."',
      "Definition of Done: the lawful basis is written down; every outreach template carries an opt-out; a record of opt-outs exists and is honoured; retention and deletion for CRM personal data is stated; the position is reviewed before any bulk send.",
    ],
  },
  {
    key: "GAP-01",
    title: "Phone enrichment for South India — the binding outreach constraint",
    owner: "Shravani",
    type: "research",
    priority: "urgent",
    label: "market-research",
    week: 1,
    body: [
      "South India sits at 93 phone numbers against 2,296 leads. The database is explicit that valuers answer the phone and that email-only outreach to this audience underperforms.",
      "What worked before: bank panel documents that happen to carry a contact column, and valuers' own practice websites. Justdial and Sulekha are hard-blocked; IndiaMART suppresses numbers on city pages but exposes them on company pages.",
      "Definition of Done: South India phone coverage materially improved, with the new numbers loaded against their contacts.",
    ],
  },
  {
    key: "GAP-02",
    title: "Harvest KSFC and APSFC panels by hand — highest-value action left",
    owner: "Shravani",
    type: "research",
    priority: "urgent",
    label: "market-research",
    week: 1,
    body: [
      "Karnataka State Financial Corporation and Andhra Pradesh State Financial Corporation both return ROBOTS_DISALLOWED to automated fetching — blocked at robots.txt, not at the content.",
      "State-owned lenders were the most productive category in the harvest: TIIC yielded 29 branch contacts and Kerala Financial Corporation 24, both at near-100% phone and email coverage. KSFC and APSFC fit the same profile and would likely add another 30–50 contacts at that quality.",
      "Opening them in an ordinary browser is the single highest-value manual action left.",
      "Definition of Done: both panels retrieved manually and their contacts loaded.",
    ],
  },
  {
    key: "GAP-03",
    title: "Verify email deliverability before any bulk send",
    owner: "Shravani",
    type: "research",
    priority: "high",
    label: "market-research",
    week: 2,
    body: [
      "3,350 emails, most from the IBBI register and some years old. A verification pass protects the sending-domain reputation.",
      "This gates MC-05 (blog 1 + newsletter 1) and every campaign after it.",
      "Definition of Done: the list is verified, hard bounces are removed, and the send is cleared.",
    ],
  },
  {
    key: "GAP-04",
    title: "Triage the 1,011 records carrying a data-quality flag",
    owner: "Shravani",
    type: "research",
    priority: "high",
    label: "market-research",
    week: 2,
    body: [
      "229 are ambiguous cross-source merges — a single-token name merged across sources may have combined two different people. 180 are possible surviving duplicates sharing a normalised name and state. 517 have no resolvable state and are therefore missing from the South India list even though some belong there. 141 are net-new and not yet cross-verified against the IBBI register.",
      "Read the flag before using a record in a personalised message.",
      "Definition of Done: flagged records are triaged; the state-unresolved set is checked for South India members.",
    ],
  },
  {
    key: "GAP-05",
    title: "Recover the Income Tax Dept contact PDFs — dead hosts, not blocks",
    owner: "Shravani",
    type: "research",
    priority: "medium",
    label: "market-research",
    week: 3,
    body: [
      "The richest untapped phone source in the project: the Tamil Nadu, Karnataka and Goa registered-valuer contact PDFs. The hosts are confirmed dead rather than blocked, so a cache or archive copy is the route.",
      "Definition of Done: recovered or formally abandoned with the reason recorded.",
    ],
  },
  {
    key: "GAP-06",
    title: "Resolve asset class for the 234 United Bank of India panel rows",
    owner: "Shravani",
    type: "research",
    priority: "medium",
    label: "market-research",
    week: 3,
    body: [
      "The source document is titled as a valuer panel with no immovable-property qualifier and carries no asset-class column, so these rows may include non-L&B valuers. They matter because that document has 100% phone coverage.",
      "Definition of Done: asset class resolved against the IBBI register, and non-L&B rows marked.",
    ],
  },
  {
    key: "CHN-01",
    title: "RVO CPE webinar play — reach hundreds of valuers at once",
    owner: "Shravani",
    type: "marketing",
    priority: "high",
    label: "market-research",
    week: 2,
    body: [
      "Every RVO must deliver around 16 CPE hours per member per year and is permanently short of content, so sponsoring or co-hosting a CEP webinar puts Valytica in front of hundreds of L&B valuers at once.",
      "The Association Officers list gives 90 direct mobiles for branch chairmen and secretaries — a warmer route than the national office. Five of those office-bearers also sit on IOV RVF's national statutory committees, which makes them unusually well-connected first calls.",
      "Feeds MR-04 (partner valuer to co-promote), MR-05 (speaker outreach) and MS-09 (webinar promotion).",
      "Definition of Done: at least one RVO or branch agrees to co-host, with a date.",
    ],
  },
  {
    key: "CHN-02",
    title: "Work the three warm lender doors found in research",
    owner: "Shravani",
    type: "sales",
    priority: "high",
    label: "market-research",
    week: 3,
    body: [
      "KSFE Kerala runs a live Land & Building empanelment through its 16 regional offices, with the AGM as the decision unit.",
      "South Indian Bank publishes its 19 Regional Heads with direct desk emails and empanels regionally.",
      "Federal Bank accepts standing applications at any branch, but only from valuers already on three or more scheduled commercial bank panels — a second-stage target.",
      "Definition of Done: each door approached and the outcome recorded against its account.",
    ],
  },
];

async function main() {
  const [project] = await db.select().from(projects).where(eq(projects.key, "VAL"));
  if (!project) throw new Error("Valytica project not found");
  const ws = project.workspaceId;

  const people = await db.select({ id: users.id, name: users.name }).from(users);
  const userId = new Map(people.map((u) => [u.name, u.id]));
  const cyc = await db.select().from(cycles).where(eq(cycles.projectId, project.id));
  const cycleId = new Map(cyc.map((c) => [c.number, c.id]));

  // Labels are workspace-scoped; create only what is missing.
  const existing = await db.select().from(labels).where(eq(labels.workspaceId, ws));
  const labelId = new Map(existing.map((l) => [l.name, l.id]));
  for (const name of new Set(SEEDS.map((s) => s.label)))
    if (!labelId.has(name)) {
      const [made] = await db
        .insert(labels)
        .values({ workspaceId: ws, name })
        .returning({ id: labels.id, name: labels.name });
      labelId.set(made.name, made.id);
    }

  // Replace a prior run.
  for (const s of SEEDS)
    await db.delete(issues).where(sql`${issues.projectId} = ${project.id} and ${issues.title} like ${s.key + " ·%"}`);

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${issues.number}), 0)::int` })
    .from(issues)
    .where(eq(issues.projectId, project.id));
  let n = max;

  for (const s of SEEDS) {
    const [made] = await db
      .insert(issues)
      .values({
        workspaceId: ws,
        projectId: project.id,
        number: ++n,
        title: `${s.key} · ${s.title}`,
        type: s.type,
        status: "todo",
        priority: s.priority,
        cycleId: cycleId.get(s.week) ?? null,
        assigneeId: userId.get(s.owner) ?? null,
        creatorId: userId.get("Sandeep") ?? null,
        description: {
          type: "doc",
          content: s.body.map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })),
        },
        sortKey: `b${String(n).padStart(4, "0")}`,
      })
      .returning({ id: issues.id });
    await db.insert(issueLabels).values({ issueId: made.id, labelId: labelId.get(s.label)! });
    console.log(`  VAL-${n}  ${s.key.padEnd(8)} ${s.priority.padEnd(6)} ${s.owner.padEnd(9)} W${s.week}`);
  }
  console.log(`\n${SEEDS.length} tickets created.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
