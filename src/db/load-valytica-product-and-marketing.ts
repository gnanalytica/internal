import { config } from "dotenv";
config({ path: ".env.local" });
import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { campaigns, contentItems, features, issues, milestones, projects, users } from "./schema";

/**
 * Fill the two department surfaces that render their own objects rather than
 * issues, and so read as empty however much work is loaded:
 *   Product   — the 8 workflow steps as features, with their build tickets linked.
 *   Marketing — the campaigns and content calendar the MC and MS tickets describe.
 * Re-runnable. Neon HTTP: sequential.
 */

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

/** The 8 steps every QA pass walks, from the MVP Launch Plan. */
const STEPS: { title: string; milestone: string; target: string; tickets: string[] }[] = [
  { title: "1 · Case creation + document upload", milestone: "Core report path demoable", target: "2026-09-03", tickets: ["FS-03"] },
  { title: "2 · AI extraction from property documents", milestone: "Extraction 90% key fields", target: "2026-09-10", tickets: ["AIE-03", "AIE-04", "AIE-06"] },
  { title: "3 · Cross-verification between documents", milestone: "Feature freeze / complete", target: "2026-09-10", tickets: ["AIE-07"] },
  { title: "4 · Valuer review, correct and override", milestone: "Core report path demoable", target: "2026-09-03", tickets: ["FS-04", "AIE-05"] },
  { title: "5 · Portal verification + manual fallback", milestone: "Core report path demoable", target: "2026-09-03", tickets: ["FS-07", "ARC-05"] },
  { title: "6 · Mobile site visit — geotag, GPS, offline", milestone: "Feature freeze / complete", target: "2026-09-10", tickets: ["FS-08"] },
  { title: "7 · Valuation workings engine", milestone: "Core report path demoable", target: "2026-09-03", tickets: ["FS-05"] },
  { title: "8 · IBA-aligned report generation + signing", milestone: "Core report path demoable", target: "2026-09-03", tickets: ["FS-06"] },
];

/** Campaigns the marketing track actually runs, from the MC and MS tickets. */
const CAMPAIGNS: {
  name: string; channel: string; start: string; end: string; tickets: string;
  content: { title: string; channel: string; publish: string; status: string; notes: string }[];
}[] = [
  {
    name: "Blog + newsletter cadence", channel: "content", start: "2026-08-14", end: "2026-09-24", tickets: "MC-03, MC-05, MC-06",
    content: [
      { title: "Blog 1", channel: "blog", publish: "2026-08-27", status: "draft", notes: "MC-05 — gated by GAP-03 (email deliverability) and DPDP-01." },
      { title: "Newsletter 1", channel: "email", publish: "2026-08-27", status: "draft", notes: "MC-05 — first send to the IBBI-sourced list." },
      { title: "Blog 2", channel: "blog", publish: "2026-09-03", status: "idea", notes: "MC-06." },
      { title: "Newsletter 2", channel: "email", publish: "2026-09-03", status: "idea", notes: "MC-06." },
    ],
  },
  {
    name: "Gated downloadables for lead capture", channel: "content", start: "2026-08-14", end: "2026-09-10", tickets: "MC-04, MC-08",
    content: [
      { title: "Valuation checklist", channel: "download", publish: "2026-09-10", status: "idea", notes: "MC-04 draft → MC-08 gated. Target 25+ captures." },
      { title: "IBA format guide", channel: "download", publish: "2026-09-10", status: "idea", notes: "MC-04 → MC-08. Ties to MR-01 bank-side acceptance mapping." },
      { title: "Rate card template", channel: "download", publish: "2026-09-10", status: "idea", notes: "MC-04 → MC-08." },
    ],
  },
  {
    name: "LinkedIn presence", channel: "linkedin", start: "2026-08-21", end: "2026-09-24", tickets: "MS-01, MS-02",
    content: [
      { title: "LinkedIn post series (12+)", channel: "linkedin", publish: "2026-09-24", status: "idea", notes: "MS-01 — scheduled manually; automation is an enhancement, not a dependency." },
      { title: "Company + founder profile refresh", channel: "linkedin", publish: "2026-08-27", status: "idea", notes: "MS-02." },
    ],
  },
  {
    name: "Instagram for surveyors", channel: "content", start: "2026-08-21", end: "2026-08-27", tickets: "MS-03, MS-04, MS-05",
    content: [
      { title: "Valytica trailer post", channel: "instagram", publish: "2026-08-27", status: "idea", notes: "MS-03." },
      { title: "Q&A format for surveyors", channel: "instagram", publish: "2026-08-27", status: "idea", notes: "MS-04." },
      { title: "HeyGen problem → solution post", channel: "instagram", publish: "2026-08-27", status: "idea", notes: "MS-05 — trial." },
    ],
  },
  {
    name: "WhatsApp valuer group", channel: "referral", start: "2026-08-28", end: "2026-09-24", tickets: "MS-07, MS-08",
    content: [
      { title: "Group seeding + rules", channel: "whatsapp", publish: "2026-09-03", status: "idea", notes: "MS-07 — target 50+ members by launch." },
      { title: "Indirect CTA in every blog/post", channel: "whatsapp", publish: "2026-09-03", status: "idea", notes: "MS-08." },
    ],
  },
  {
    name: "Webinar / podcast", channel: "events", start: "2026-09-04", end: "2026-09-24", tickets: "MC-09, MS-09, MR-05, CHN-01",
    content: [
      { title: "Podcast / webinar recording", channel: "video", publish: "2026-09-10", status: "idea", notes: "MC-09." },
      { title: "Webinar promotion + registration drive", channel: "linkedin", publish: "2026-09-10", status: "idea", notes: "MS-09 — blocked by CHN-01 until an RVO or branch agrees to co-host." },
    ],
  },
  {
    name: "Launch week sequence", channel: "email", start: "2026-09-18", end: "2026-09-24", tickets: "MC-10, MS-10",
    content: [
      { title: "Launch-week posts + emails", channel: "email", publish: "2026-09-23", status: "idea", notes: "MC-10 written and queued; MS-10 fires across LinkedIn, IG, newsletter, WhatsApp." },
    ],
  },
];

async function main() {
  const [project] = await db.select().from(projects).where(eq(projects.key, "VAL"));
  if (!project) throw new Error("Valytica project not found");
  const ws = project.workspaceId;
  const people = await db.select({ id: users.id, name: users.name }).from(users);
  const userId = new Map(people.map((u) => [u.name, u.id]));

  const ms = await db.select().from(milestones).where(eq(milestones.projectId, project.id));
  const msId = new Map(ms.map((m) => [m.name, m.id]));

  // ---- Product: the 8 workflow steps ----
  await db.delete(features).where(eq(features.projectId, project.id));
  const all = await db
    .select({ id: issues.id, title: issues.title })
    .from(issues)
    .where(eq(issues.projectId, project.id));
  const issueByKey = new Map<string, string>();
  for (const i of all) {
    const key = i.title.split(" · ")[0];
    if (!key.includes(".")) issueByKey.set(key, i.id);
  }

  let linked = 0;
  for (const [i, s] of STEPS.entries()) {
    const [made] = await db
      .insert(features)
      .values({
        workspaceId: ws,
        projectId: project.id,
        milestoneId: msId.get(s.milestone) ?? null,
        title: s.title,
        status: "planned",
        targetDate: at(s.target),
        ownerId: userId.get("Jayasaagar") ?? null,
        sortKey: `a${String(i).padStart(3, "0")}`,
      })
      .returning({ id: features.id });
    for (const key of s.tickets) {
      const id = issueByKey.get(key);
      if (!id) continue;
      await db.update(issues).set({ featureId: made.id }).where(eq(issues.id, id));
      linked++;
    }
  }
  console.log(`features   ${STEPS.length} workflow steps · ${linked} build tickets linked`);

  // ---- Marketing: campaigns + content calendar ----
  await db.delete(contentItems).where(eq(contentItems.projectId, project.id));
  await db.delete(campaigns).where(eq(campaigns.projectId, project.id));
  let items = 0;
  for (const c of CAMPAIGNS) {
    const [made] = await db
      .insert(campaigns)
      .values({
        workspaceId: ws,
        projectId: project.id,
        name: c.name,
        channel: c.channel,
        status: "planned",
        startDate: at(c.start),
        endDate: at(c.end),
        ownerId: userId.get("Shravani") ?? null,
        entity: "India",
      })
      .returning({ id: campaigns.id });
    for (const [j, it] of c.content.entries()) {
      await db.insert(contentItems).values({
        workspaceId: ws,
        projectId: project.id,
        campaignId: made.id,
        title: it.title,
        channel: it.channel,
        status: it.status,
        publishDate: at(it.publish),
        notes: `${it.notes} (from ${c.tickets})`,
        ownerId: userId.get("Shravani") ?? null,
      } as never);
      items++;
      void j;
    }
  }
  console.log(`campaigns  ${CAMPAIGNS.length} · content items ${items}`);
  void sql;
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
