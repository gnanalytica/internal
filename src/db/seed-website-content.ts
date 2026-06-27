import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq, isNull } from "drizzle-orm";

import { db, schema } from "./index";

/**
 * Import public content from the Gnanalytica marketing site
 * (/Users/sandeeppvn/code/Gnanalytica-Website) into the hub:
 *   - Company "Focus this quarter" bets (workspaces.bets), grounded in site copy
 *   - Each product project's public tagline + live URL (shown on the Overview)
 *   - A "Public Profile" Docs page per product (category, summary, principle,
 *     features, highlights) under that project's Docs
 *   - Company Wiki pages (projectId = null): Company & Brand, Consulting &
 *     Services, Brand & Design System, Messaging Library
 *
 * All copy is lifted from the real site — no invented metrics.
 * Idempotent (upserts by title + project scope). Run: npm run db:seed-website-content
 */

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

// ---- company "Focus this quarter" bets (grounded in site copy) ----
const BETS = [
  "Ship real AI tools in production — not pilots or slideware",
  "Help businesses become genuinely AI-ready (consulting)",
  "Human-in-the-loop, built for trust",
];

// ---- per-product public content (from lib/products.js on the site) ----
type Product = {
  project: string; // hub project name
  category: string;
  tagline: string;
  url: string | null;
  cta: string;
  summary: string;
  principle: string;
  features: string[];
  highlights: string[];
  note?: string;
};

const PRODUCTS: Product[] = [
  {
    project: "Valytica",
    category: "Valuation Intelligence",
    tagline: "Valuation reports in minutes, not days.",
    url: "https://valytica.gnanalytica.com",
    cta: "Start free",
    summary:
      "An AI-assisted valuation workspace that replaces fragmented tools with one focused flow — from document extraction to an IBA-aligned PDF.",
    principle: "AI suggests. The valuer approves.",
    features: [
      "AI field extraction — documents become pre-filled case fields.",
      "State portal checks built in (Telangana, Andhra Pradesh, Karnataka).",
      "Mobile site evidence with geotagged photos.",
      "IBA-aligned PDF reports.",
    ],
    highlights: [
      "Minutes turnaround",
      "3 state portal checks",
      "IBA-aligned",
      "Indian data residency on AWS Mumbai, encryption at rest and in transit, full audit trail on every case.",
    ],
  },
  {
    project: "Standup-AI",
    category: "Meeting Intelligence",
    tagline: "Live meeting intelligence.",
    url: "https://standup.gnanalytica.com",
    cta: "Open Standup",
    summary:
      "An autonomous bot that joins your Google Meet, captures the conversation, and turns it into a live knowledge graph, summaries and tracked action items — synced to Linear and Slack.",
    principle: "The bot proposes. Your team approves.",
    features: [
      "Autonomous Meet bot — captures the transcript, no note-taking needed.",
      "Live knowledge graph — entities, decisions and relationships streamed in real time.",
      "Action items → Linear, via a human-reviewed queue before tickets are created.",
      "Summaries in Slack — a canonical digest on meeting end.",
    ],
    highlights: [
      "Live streaming knowledge graph",
      "Joins Google Meet automatically",
      "Linear sync",
      "Slack digest",
    ],
  },
  {
    project: "AI Workshop",
    category: "AI Workshops",
    tagline: "From curious to capable in 30 days.",
    url: "https://learn.gnanalytica.com",
    cta: "Enroll now",
    summary:
      "A 30-day cohort platform for AI workshops — curriculum, capstones, attendance, grading, pods and analytics in one place. No spreadsheets, no scattered links.",
    principle: "Curiosity in. Capability out.",
    features: [
      "Daily curriculum — 30 MDX-authored days, gated by the cohort schedule.",
      "Pods + faculty — small accountability pods, auditable events end-to-end.",
      "Grading + analytics — server-enforced roles, real-time cohort and pod analytics.",
      "Built for outcomes — every day points to a portfolio-grade capstone on demo day.",
    ],
    highlights: [
      "30-day structured curriculum",
      "Accountability pods",
      "Real-time analytics",
      "Capstone demo day",
    ],
  },
  {
    project: "Healthytica",
    category: "Biomarker Intelligence",
    tagline: "Your biomarkers, over time.",
    url: "https://healthytica.gnanalytica.com",
    cta: "Try Healthytica",
    summary:
      "Healthytica turns your lab reports into clear, longitudinal insights — tracking how your biomarkers change over time with explainable AI, no medical jargon required.",
    principle: "Clear insights, not medical jargon.",
    features: [
      "Longitudinal trends — biomarker movement across every report.",
      "Explainable flags — rule-based, transparent findings with evidence.",
      "LLM report ingestion — PDF values extracted, normalized and aligned.",
      "Preventive & personalised — age, sex, lifestyle and family history weighting.",
    ],
    highlights: [
      "Longitudinal tracking",
      "Explainable AI",
      "Reads PDF reports",
      "Personalised insights",
    ],
    note: "Healthytica is a wellness tool, not a medical device. Always consult a qualified clinician.",
  },
];

// Atlas isn't on the public site yet; give it a grounded internal tagline only.
const INTERNAL_TAGLINES: { project: string; tagline: string }[] = [
  { project: "Atlas", tagline: "Project feasibility & lender studies — TEV / LIE / DPR." },
];

async function main() {
  const [ws] = await db
    .select({ id: schema.workspaces.id })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.slug, "gnanalytica"))
    .limit(1);
  if (!ws) return console.log("No gnanalytica workspace.");

  const [anyUser] = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  const creatorId = anyUser?.id ?? null;

  // 1. Company bets.
  await db.update(schema.workspaces).set({ bets: BETS }).where(eq(schema.workspaces.id, ws.id));
  console.log(`Bets set: ${BETS.length}.`);

  // 2. Product taglines + URLs.
  let tagged = 0;
  for (const pr of PRODUCTS) {
    const res = await db
      .update(schema.projects)
      .set({ tagline: pr.tagline, url: pr.url })
      .where(and(eq(schema.projects.workspaceId, ws.id), eq(schema.projects.name, pr.project)))
      .returning({ id: schema.projects.id });
    if (res.length === 0) console.log(`  ! project not found: ${pr.project}`);
    else tagged += res.length;
  }
  for (const it of INTERNAL_TAGLINES) {
    await db
      .update(schema.projects)
      .set({ tagline: it.tagline })
      .where(and(eq(schema.projects.workspaceId, ws.id), eq(schema.projects.name, it.project)));
  }
  console.log(`Product taglines/URLs set: ${tagged}/${PRODUCTS.length}.`);

  // ---- page upsert helper (handles workspace-level pages, projectId = null) ----
  async function upsertPage(
    title: string,
    icon: string,
    content: Node,
    projectId: string | null,
    position: string,
  ): Promise<void> {
    const scope = projectId
      ? eq(schema.pages.projectId, projectId)
      : isNull(schema.pages.projectId);
    const [existing] = await db
      .select({ id: schema.pages.id })
      .from(schema.pages)
      .where(
        and(
          eq(schema.pages.workspaceId, ws.id),
          scope,
          eq(schema.pages.title, title),
          isNull(schema.pages.deletedAt),
        ),
      )
      .limit(1);
    const values = {
      workspaceId: ws.id,
      projectId,
      parentId: null,
      title,
      icon,
      content,
      contentText: plain(content).slice(0, 20000),
      creatorId,
      position,
    };
    if (existing) await db.update(schema.pages).set(values).where(eq(schema.pages.id, existing.id));
    else await db.insert(schema.pages).values(values);
  }

  // 3. Per-product "Public Profile" docs.
  let profiles = 0;
  for (const pr of PRODUCTS) {
    const [project] = await db
      .select({ id: schema.projects.id })
      .from(schema.projects)
      .where(and(eq(schema.projects.workspaceId, ws.id), eq(schema.projects.name, pr.project)))
      .limit(1);
    if (!project) continue;
    const nodes: Node[] = [
      h(1, `${pr.project} — Public Profile`),
      p(`${pr.category} · ${pr.tagline}`),
      p(pr.summary),
    ];
    if (pr.url) nodes.push(p(`Live: ${pr.url} · CTA: “${pr.cta}”`));
    nodes.push(p(`Principle: ${pr.principle}`));
    nodes.push(h(2, "Features"));
    nodes.push(bullets(pr.features));
    nodes.push(h(2, "Highlights"));
    nodes.push(bullets(pr.highlights));
    if (pr.note) {
      nodes.push(h(2, "Note"));
      nodes.push(p(pr.note));
    }
    nodes.push(p("Source: Gnanalytica marketing site (lib/products.js)."));
    await upsertPage("Public Profile", "🌐", doc(...nodes), project.id, "ab0");
    profiles++;
  }
  console.log(`Product public-profile docs upserted: ${profiles}.`);

  // 4. Company Wiki pages (projectId = null).
  await upsertPage(
    "Company & Brand",
    "🪷",
    doc(
      h(1, "Company & Brand"),
      p("Four products · One AI studio."),
      h(2, "Positioning"),
      p("Wisdom-driven AI products & consulting."),
      p("We build focused AI products — for valuation, meetings, learning and health — and help businesses become genuinely AI-ready. Real tools in production, not slideware."),
      h(2, "Mission"),
      p("Gnana means wisdom. We build AI that carries it."),
      p("Capability is cheap now; judgement isn't. Gnanalytica builds AI products that pair real intelligence with the context, compliance and care a serious decision deserves — from a valuer signing a report to a clinician reading a trend."),
      p("Small team, high standards, and the same craft whether the product is ours or yours."),
      h(2, "Principles"),
      bullets([
        "Human in the loop — AI proposes, people decide. Every product keeps judgement with the expert.",
        "Ship real tools — working software in production, not pilots and slideware.",
        "Built for trust — data residency, audit trails and explainability are features, not afterthoughts.",
      ]),
      p("Source: Gnanalytica marketing site (Hero.js, About.js)."),
    ),
    null,
    "w00",
  );

  await upsertPage(
    "Consulting & Services",
    "🧭",
    doc(
      h(1, "Consulting & Services"),
      p("Beyond our own products, we help businesses become AI-ready — from first prototype to production."),
      h(2, "What we do (outcomes)"),
      bullets([
        "Revenue growth — lead scoring, propensity models, advanced analytics.",
        "Operational efficiency — intelligent automation and internal AI tools.",
        "Risk & compliance — data governance and model risk management.",
        "Custom AI products — first prototype to production.",
      ]),
      h(2, "How we engage"),
      bullets([
        "Discover — a complimentary working session mapping where AI adds value.",
        "Design — a focused plan around the smallest thing worth building.",
        "Build — a working tool with client iteration and human control at every decision.",
        "Embed — handover of an owned, documented, governed solution.",
      ]),
      p("Primary CTA: book a complimentary 30-minute strategy session (#contact)."),
      p("Source: Gnanalytica marketing site (WhatWeDo.js, ProcessSteps.js)."),
    ),
    null,
    "w01",
  );

  await upsertPage(
    "Brand & Design System",
    "🎨",
    doc(
      h(1, "Brand & Design System"),
      h(2, "Typography"),
      bullets([
        "Display: Instrument Serif (Georgia fallback) — headlines.",
        "Body: Inter — default text.",
        "Mono / eyebrow: JetBrains Mono — labels and accent type.",
      ]),
      h(2, "Palette"),
      bullets([
        "Canvas (warm light base): #faf7f1.",
        "Night (dark accent bands): #0b0d14.",
        "Brand indigo: #4f46e5, accent #6366f1.",
      ]),
      h(2, "Product gradients"),
      bullets([
        "Valytica — blue #1d4ed8 → #3b82f6.",
        "Standup — indigo → purple #6366f1 → #a855f7.",
        "Learn — burnt orange / rust #b8431f → #e0673c.",
        "Healthytica — teal → green #2492ab → #2fa84f.",
      ]),
      p("Logo: an animated gradient “G” mark (indigo → purple)."),
      p("Source: Gnanalytica marketing site (tailwind.config.js, inline styles)."),
    ),
    null,
    "w02",
  );

  await upsertPage(
    "Messaging Library",
    "✍️",
    doc(
      h(1, "Messaging Library"),
      h(2, "Master messaging"),
      bullets([
        "Tagline: Wisdom-driven AI products & consulting.",
        "Hero: Wisdom-driven AI products & consulting — real tools in production, not slideware.",
        "Eyebrow: Four products · One AI studio.",
      ]),
      h(2, "Meta description"),
      p("Gnanalytica builds wisdom-driven AI products — Valytica for valuation, Standup for meetings, Learn for AI workshops and Healthytica for health — and helps businesses become AI-ready."),
      h(2, "Product one-liners"),
      bullets([
        "Valytica — Valuation reports in minutes, not days. (AI suggests. The valuer approves.)",
        "Standup — Live meeting intelligence. (The bot proposes. Your team approves.)",
        "Learn — From curious to capable in 30 days. (Curiosity in. Capability out.)",
        "Healthytica — Your biomarkers, over time. (Clear insights, not medical jargon.)",
      ]),
      p("Source: Gnanalytica marketing site (meta tags, lib/products.js)."),
    ),
    null,
    "w03",
  );
  console.log("Company Wiki pages upserted: 4.");

  console.log("Done — website content imported.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
