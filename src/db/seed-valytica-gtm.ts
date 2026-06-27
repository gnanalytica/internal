import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq, max } from "drizzle-orm";

import { db, schema } from "./index";

/**
 * Seed the Valytica WhatsApp-marketing GTM initiative into the hub:
 * - a brief wiki page (single source of truth)
 * - a Marketing campaign (channel=whatsapp) + content deliverables
 * - a "GTM & WhatsApp Launch Readiness" roadmap feature + engineering tickets
 * Enterprise inquiries route into Sales (CRM); feedback into Support — no new
 * department. Idempotent. Run: npm run db:seed-valytica-gtm
 */

const EMAIL: Record<string, string> = {
  sandeep: "sandeep@gnanalytica.com",
  jay: "jayasaagar@gnanalytica.com",
  aparna: "aparna@gnanalytica.com",
  sanjana: "sanjana@gnanalytica.com",
  raunak: "raunak@gnanalytica.com",
  harshith: "harshith@gnanalytica.com",
  shravani: "shravani@gnanalytica.com",
};

const SALES_EMAIL = "sales@gnanalytica.com";
const SUPPORT_EMAIL = "support@gnanalytica.com";

// ---- tiny TipTap helpers ----
type Node = { type: string; attrs?: Record<string, unknown>; content?: Node[]; text?: string };
const p = (t?: string): Node => ({ type: "paragraph", content: t ? [{ type: "text", text: t }] : [] });
const h = (level: number, t: string): Node => ({ type: "heading", attrs: { level }, content: [{ type: "text", text: t }] });
const bullets = (items: string[]): Node => ({
  type: "bulletList",
  content: items.map((t) => ({ type: "listItem", content: [p(t)] })),
});
const doc = (...nodes: Node[]): Node => ({ type: "doc", content: nodes });
const plain = (n: Node): string => (n.type === "text" ? (n.text ?? "") : (n.content ?? []).map(plain).join(" "));

const BRIEF = doc(
  h(1, "Valytica · WhatsApp Launch — brief"),
  p("Deliverables and supporting materials for the WhatsApp marketing campaign. Campaign + content live in Marketing; inbound enterprise inquiries route into Sales; in-app build items are Engineering tickets under the GTM Launch Readiness feature."),
  h(2, "1. WhatsApp marketing message"),
  p("A concise, engaging message that communicates Valytica's value proposition."),
  h(2, "2. Demo video (feature showcase)"),
  bullets([
    "Data extraction: upload valuation documents → AI extraction of property details.",
    "AI property value suggestions: show at least two AI-generated valuations from the uploaded docs.",
    "Report generation: produce the final report; highlight speed, accuracy and professional format.",
  ]),
  h(2, "3. Sample report"),
  p("A sample valuation report for demos and self-testing."),
  h(2, "4. Valytica landing page"),
  p("valytica.gnanalytica.com fully functional and public-ready, with an apt professional logo aligned to the Gnanalytica brand."),
  h(2, "5. User activity & analytics"),
  bullets([
    "Registered users, document uploads, report generations.",
    "Email IDs of users who performed these actions.",
    "Page-/module-wise activity logs where applicable.",
  ]),
  h(2, "6. Feedback form"),
  p("A simple in-app form for users to submit experience, suggestions or issues."),
  h(2, "7. Custom requirements & support"),
  p(`Enterprise / custom requirements CTA on the landing page + app footer → ${SALES_EMAIL} (inquiries become Sales leads). General support / feedback → ${SUPPORT_EMAIL} (becomes Support tickets).`),
);

// Marketing content deliverables (#1–#3).
const CONTENT: { title: string; status: string; who: string; notes: string; url?: string }[] = [
  {
    title: "WhatsApp marketing message — Valytica value prop",
    status: "draft",
    who: "shravani",
    notes:
      "Hook: AI-assisted valuations for Indian valuers. Upload docs → AI extracts property details → get value suggestions → generate an IBA-format report in minutes. CTA: reply to try a free sample report.",
  },
  {
    title: "Demo video: extraction → AI value suggestions → report",
    status: "idea",
    who: "shravani",
    notes: "Screen-record the full journey: upload → AI extraction → ≥2 AI value suggestions → final report. ~60–90s.",
  },
  {
    title: "Sample valuation report (demo + self-test)",
    status: "idea",
    who: "aparna",
    notes: "Generate a polished sample report via the app for demos and prospects to self-test against.",
  },
];

// GTM build feature → engineering/product tickets (#4–#7 + sample-report artifact).
type IssueStatus = "backlog" | "todo" | "in_progress" | "in_review" | "done";
const GTM_TICKETS: [title: string, who: string, status: IssueStatus][] = [
  ["Landing page valytica.gnanalytica.com — production-ready public site", "raunak", "todo"],
  ["Valytica logo aligned to the Gnanalytica brand identity", "shravani", "in_progress"],
  ["In-app Activity & Analytics page (users, uploads, report gens, emails, module logs)", "raunak", "todo"],
  ["Activity event logging + analytics data layer", "harshith", "todo"],
  ["In-app feedback form (experience, suggestions, bug reports)", "raunak", "todo"],
  [`Route feedback submissions → Support tickets (${SUPPORT_EMAIL})`, "harshith", "backlog"],
  [`Enterprise / custom-requirements CTA (landing + footer → ${SALES_EMAIL})`, "raunak", "todo"],
  ["Route enterprise inquiries → Sales CRM (leads/deals)", "harshith", "backlog"],
];

async function main() {
  const [ws] = await db
    .select({ id: schema.workspaces.id })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.slug, "gnanalytica"))
    .limit(1);
  if (!ws) return console.log("No gnanalytica workspace.");

  const [project] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(and(eq(schema.projects.workspaceId, ws.id), eq(schema.projects.name, "Valytica")))
    .limit(1);
  if (!project) return console.log("No Valytica project.");

  const users = await db.select({ id: schema.users.id, email: schema.users.email }).from(schema.users);
  const byEmail = new Map(users.map((u) => [u.email, u.id]));
  const uid = (k: string) => byEmail.get(EMAIL[k]) ?? null;

  // 1. Brief page
  const briefTitle = "Valytica · WhatsApp Launch — brief";
  const [pageExists] = await db
    .select({ id: schema.pages.id })
    .from(schema.pages)
    .where(and(eq(schema.pages.workspaceId, ws.id), eq(schema.pages.title, briefTitle)))
    .limit(1);
  if (!pageExists) {
    await db.insert(schema.pages).values({
      workspaceId: ws.id,
      title: briefTitle,
      icon: "📣",
      content: BRIEF,
      contentText: plain(BRIEF).slice(0, 20000),
      creatorId: uid("jay"),
    });
  }

  // 2. Marketing campaign + content
  const campName = "Valytica · WhatsApp Launch";
  let [campaign] = await db
    .select({ id: schema.campaigns.id })
    .from(schema.campaigns)
    .where(and(eq(schema.campaigns.workspaceId, ws.id), eq(schema.campaigns.name, campName)))
    .limit(1);
  if (!campaign) {
    [campaign] = await db
      .insert(schema.campaigns)
      .values({
        workspaceId: ws.id,
        projectId: project.id,
        name: campName,
        channel: "whatsapp",
        status: "active",
        budget: 5000,
        entity: "India",
        ownerId: uid("shravani"),
        startDate: new Date("2026-06-25T12:00:00Z"),
        endDate: new Date("2026-07-31T12:00:00Z"),
      })
      .returning({ id: schema.campaigns.id });
  }

  const existingContent = await db
    .select({ title: schema.contentItems.title })
    .from(schema.contentItems)
    .where(eq(schema.contentItems.workspaceId, ws.id));
  const haveContent = new Set(existingContent.map((c) => c.title));
  let contentCount = 0;
  for (const c of CONTENT) {
    if (haveContent.has(c.title)) continue;
    await db.insert(schema.contentItems).values({
      workspaceId: ws.id,
      projectId: project.id,
      campaignId: campaign.id,
      title: c.title,
      channel: "whatsapp",
      status: c.status,
      url: c.url ?? null,
      notes: c.notes,
      ownerId: uid(c.who),
    });
    contentCount++;
  }

  // 3. GTM roadmap feature + engineering tickets
  const featTitle = "GTM & WhatsApp Launch Readiness";
  const [featExists] = await db
    .select({ id: schema.features.id })
    .from(schema.features)
    .where(and(eq(schema.features.projectId, project.id), eq(schema.features.title, featTitle)))
    .limit(1);
  let ticketCount = 0;
  if (!featExists) {
    const start = new Date("2026-06-20T12:00:00Z");
    const target = new Date("2026-07-31T12:00:00Z");
    const [feature] = await db
      .insert(schema.features)
      .values({
        workspaceId: ws.id,
        projectId: project.id,
        title: featTitle,
        status: "building",
        startDate: start,
        targetDate: target,
        spec: doc(
          p("Launch-readiness work for the WhatsApp campaign: public landing page + logo, in-app activity/analytics, feedback form, and the enterprise-contact CTA. See the linked brief."),
        ),
        ownerId: uid("jay"),
        sortKey: "a99",
      })
      .returning({ id: schema.features.id });

    // pick the cycle covering each ticket's createdAt
    const cycles = await db
      .select({ id: schema.cycles.id, startDate: schema.cycles.startDate, endDate: schema.cycles.endDate })
      .from(schema.cycles)
      .where(eq(schema.cycles.workspaceId, ws.id));
    const cycleFor = (dt: Date) => cycles.find((c) => dt >= c.startDate && dt <= c.endDate)?.id ?? null;

    const [{ value: maxNum }] = await db
      .select({ value: max(schema.issues.number) })
      .from(schema.issues)
      .where(and(eq(schema.issues.workspaceId, ws.id), eq(schema.issues.projectId, project.id)));
    let issueNum = maxNum ?? 0;
    const span = target.getTime() - start.getTime();
    const priorities = ["high", "high", "medium", "medium", "medium", "low", "high", "low"];
    for (let i = 0; i < GTM_TICKETS.length; i++) {
      const [title, who, status] = GTM_TICKETS[i];
      const createdAt = new Date(start.getTime() + (span * (i + 0.5)) / GTM_TICKETS.length);
      await db.insert(schema.issues).values({
        workspaceId: ws.id,
        projectId: project.id,
        featureId: feature.id,
        cycleId: cycleFor(createdAt),
        number: ++issueNum,
        title,
        status,
        priority: priorities[i % priorities.length],
        assigneeId: uid(who),
        creatorId: uid("jay"),
        sortKey: `a${String(i).padStart(3, "0")}`,
        createdAt,
        updatedAt: createdAt,
      });
      ticketCount++;
    }
  }

  console.log(`Valytica GTM seeded: brief page, campaign, ${contentCount} content items, ${ticketCount} tickets.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
