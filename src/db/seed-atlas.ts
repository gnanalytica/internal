import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq, isNull, max } from "drizzle-orm";

import { db, schema } from "./index";

/**
 * Seed "Atlas" — a new product that is the project-feasibility part of Valytica
 * (TEV / LIE / DPR engagements: staged workflow, declarative financial model,
 * chaptered lender reports) carved out into its own product.
 *
 * Atlas is early-stage: milestones are planned/future, features are idea/planned
 * (no "shipped" history), and only a small, honest starter backlog of issues
 * exists. No business metrics are fabricated. Idempotent.
 * Run: npm run db:seed-atlas
 */

// ---- tiny TipTap helpers ----
type Node = { type: string; attrs?: Record<string, unknown>; content?: Node[]; text?: string };
const p = (t?: string): Node => ({ type: "paragraph", content: t ? [{ type: "text", text: t }] : [] });
const h = (level: number, t: string): Node => ({ type: "heading", attrs: { level }, content: [{ type: "text", text: t }] });
const bullets = (items: string[]): Node => ({
  type: "bulletList",
  content: items.map((t) => ({ type: "listItem", content: [p(t)] })),
});
const docNode = (...nodes: Node[]): Node => ({ type: "doc", content: nodes });
const plain = (n: Node): string => (n.type === "text" ? (n.text ?? "") : (n.content ?? []).map(plain).join(" "));

const MILESTONES: { key: string; name: string; target: string; desc: string }[] = [
  { key: "m0", name: "v0 · Carve-out & Foundation", target: "2026-08-31", desc: "Lift the engagement engine out of Valytica and stand up Atlas's own tenancy + case shell." },
  { key: "m1", name: "v0.5 · Feasibility Workflow", target: "2026-09-30", desc: "The staged engagement lifecycle plus project-document intake and extraction." },
  { key: "m2", name: "v1.0 · Financial Model & Reports", target: "2026-10-31", desc: "Declarative financial model (projections + sensitivity) and grounded, chaptered reports." },
  { key: "m3", name: "v1.1 · Lender Features & GTM", target: "2026-12-15", desc: "Lender/bank report templates, secure sharing, and go-to-market." },
];

const FEATURES: {
  title: string;
  milestone: string;
  status: string;
  start: string;
  target: string;
  intro: string;
  reqs: string[];
  issues?: { title: string; status: string }[];
}[] = [
  {
    title: "Engagement carve-out from Valytica",
    milestone: "m0",
    status: "planned",
    start: "2026-08-01",
    target: "2026-08-31",
    intro: "Extract Valytica's project-engagement engine (TEV / LIE / DPR) into a standalone product.",
    reqs: [
      "Lift the engagement schema (project work, asset_class = NULL) and staged workflow out of Valytica into Atlas.",
      "Reuse the shared AI building blocks (extraction, chapter synthesis, narrative grounding) rather than reinventing them.",
      "Keep a clean boundary so Valytica's valuation cases and Atlas's engagements evolve independently.",
      "Decide shared vs forked services (auth, storage, AI gateway) for the carve-out.",
    ],
    issues: [
      { title: "Inventory Valytica engagement-engine modules to extract", status: "todo" },
      { title: "Define Atlas ↔ Valytica service boundary (auth / storage / AI)", status: "backlog" },
      { title: "Spin up Atlas repo + CI/deploy on Vercel (bom1)", status: "todo" },
    ],
  },
  {
    title: "Auth, Orgs & Case Shell",
    milestone: "m0",
    status: "planned",
    start: "2026-08-10",
    target: "2026-08-31",
    intro: "Standalone multi-tenancy and the project-engagement case shell.",
    reqs: [
      "Email/SMS OTP + Google auth; org-of-one; RLS on every table (India data residency).",
      "Engagement CRUD with type (TEV / LIE / DPR) and a status machine.",
      "Roles for lead engineer, reviewer, and analyst.",
    ],
    issues: [
      { title: "Stand up auth + org-of-one (RLS scaffold)", status: "backlog" },
      { title: "Engagement CRUD + status machine", status: "backlog" },
    ],
  },
  {
    title: "Staged Feasibility Workflow",
    milestone: "m1",
    status: "planned",
    start: "2026-09-01",
    target: "2026-09-30",
    intro: "The engagement lifecycle as explicit, gated stages.",
    reqs: [
      "Stages: scope → information → technical → financial → draft → review → issued.",
      "Per-stage checklists and gating (no issuing without review sign-off).",
      "Information-request / data-room tracking with the client.",
    ],
    issues: [{ title: "Model the 7-stage workflow + stage gating", status: "backlog" }],
  },
  {
    title: "Document Intake & Extraction",
    milestone: "m1",
    status: "planned",
    start: "2026-09-10",
    target: "2026-09-30",
    intro: "Bring in project documents and extract the facts feasibility needs.",
    reqs: [
      "Upload DPRs, financials, approvals, and technical reports to India-region storage.",
      "AI extraction of project facts (capacity, capex, schedule, promoters, approvals) with confidence + source citation.",
      "Deterministic cross-document conflict detection.",
    ],
    issues: [
      { title: "Project-document upload to India-region storage", status: "backlog" },
      { title: "Extraction prompt for project facts (capex / capacity / schedule)", status: "backlog" },
    ],
  },
  {
    title: "Declarative Financial Model Engine",
    milestone: "m2",
    status: "idea",
    start: "2026-10-01",
    target: "2026-10-31",
    intro: "Projections and sensitivity from a declarative model — no code execution.",
    reqs: [
      "Declarative formula engine (per Valytica's TEV/LIE L2 design) — inputs → derived metrics, no arbitrary code.",
      "Standard outputs: DSCR, IRR, NPV, break-even.",
      "Scenario comparison (base / downside / upside) with sensitivity tables.",
    ],
  },
  {
    title: "Chaptered Reports (TEV / LIE / DPR)",
    milestone: "m2",
    status: "idea",
    start: "2026-10-10",
    target: "2026-10-31",
    intro: "Generate the multi-chapter feasibility report, grounded in engagement facts.",
    reqs: [
      "Chapter synthesis from retrieved chunks + the engagement corpus.",
      "Narrative grounding review: every claim verified against engagement facts or marked [verify: …].",
      "PDF + editable DOCX output in a lender-ready structure.",
    ],
  },
  {
    title: "Lender & Bank Templates",
    milestone: "m3",
    status: "idea",
    start: "2026-11-01",
    target: "2026-12-10",
    intro: "Make reports fit each lender's required format and get them there securely.",
    reqs: [
      "Bank/lender-specific report templates, plus firm-editable templates.",
      "Secure sharing / export to the lender.",
      "India-region AI (Vertex / Bedrock Mumbai) before the first lender customer.",
    ],
  },
  {
    title: "GTM & Launch",
    milestone: "m3",
    status: "idea",
    start: "2026-11-15",
    target: "2026-12-15",
    intro: "Take Atlas to market as its own product.",
    reqs: [
      "Public landing + positioning distinct from Valytica.",
      "Pricing + onboarding for engineering / advisory firms.",
      "Pilot with a lender or advisory partner.",
    ],
  },
];

const DOCS: { title: string; icon: string; nodes: Node[] }[] = [
  {
    title: "Atlas — Product Brief",
    icon: "🧭",
    nodes: [
      h(1, "Atlas — Product Brief"),
      p("Atlas is the project-feasibility product carved out of Valytica: techno-economic feasibility (TEV), lender's independent engineer (LIE), and detailed project reports (DPR)."),
      h(2, "Why a separate product"),
      bullets([
        "Valytica is single-property valuation; Atlas is multi-stage project feasibility — different buyer, workflow, and report.",
        "The engagement engine already exists inside Valytica (TEV/LIE/DPR + formula engine + chaptered reports); Atlas extracts it so each can evolve independently.",
      ]),
      h(2, "Who it's for"),
      p("Engineering / advisory firms and lenders that commission feasibility and independent-engineer studies."),
    ],
  },
  {
    title: "Feasibility Workflow",
    icon: "📋",
    nodes: [
      h(1, "Feasibility Workflow"),
      p("An engagement moves through explicit, gated stages:"),
      bullets([
        "Scope — engagement type, deliverables, fee.",
        "Information — data-room / information requests from the client.",
        "Technical — site, capacity, technology assessment.",
        "Financial — projections, DSCR/IRR/NPV, sensitivity.",
        "Draft — chaptered report drafted + grounded.",
        "Review — independent review sign-off.",
        "Issued — final report delivered to the lender.",
      ]),
    ],
  },
  {
    title: "Financial Model Engine",
    icon: "📐",
    nodes: [
      h(1, "Financial Model Engine"),
      p("Projections come from a declarative formula engine — inputs map to derived metrics with no arbitrary code execution (the safe pattern proven in Valytica's TEV/LIE L2 design)."),
      bullets([
        "Inputs: capex, capacity, ramp-up, pricing, opex, debt terms.",
        "Outputs: DSCR, IRR, NPV, break-even.",
        "Scenarios: base / downside / upside with sensitivity tables.",
      ]),
      p("Reference: Valytica docs/superpowers/specs/2026-06-11-tev-lie-l2-formula-engine-design.md."),
    ],
  },
  {
    title: "Carve-out from Valytica",
    icon: "🔀",
    nodes: [
      h(1, "Carve-out from Valytica"),
      p("How Atlas separates from Valytica:"),
      bullets([
        "Shared building blocks: AI extraction, chapter synthesis, narrative grounding, India-region storage + AI gateway.",
        "Atlas-specific: engagement schema (asset_class NULL), staged workflow, financial model, lender templates.",
        "Decision: shared vs forked auth/storage services — to be settled in v0 · Carve-out.",
      ]),
    ],
  },
];

async function main() {
  const [ws] = await db
    .select({ id: schema.workspaces.id })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.slug, "gnanalytica"))
    .limit(1);
  if (!ws) return console.log("No gnanalytica workspace.");

  // Owner: reuse Valytica's owner if present, else any user.
  const [valytica] = await db
    .select({ ownerId: schema.projects.ownerId })
    .from(schema.projects)
    .where(and(eq(schema.projects.workspaceId, ws.id), eq(schema.projects.name, "Valytica")))
    .limit(1);
  const [anyUser] = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  const ownerId = valytica?.ownerId ?? anyUser?.id ?? null;

  // 1. Upsert the Atlas project.
  let [project] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(and(eq(schema.projects.workspaceId, ws.id), eq(schema.projects.name, "Atlas")))
    .limit(1);
  const projectValues = {
    workspaceId: ws.id,
    name: "Atlas",
    key: "ATL",
    description: "Project feasibility & lender studies — TEV / LIE / DPR. Carved out of Valytica's engagement engine into its own product.",
    color: "#0d9488",
    kind: "project" as const,
    ownerId,
  };
  if (project) {
    await db.update(schema.projects).set(projectValues).where(eq(schema.projects.id, project.id));
  } else {
    [project] = await db.insert(schema.projects).values(projectValues).returning({ id: schema.projects.id });
  }
  const projectId = project.id;
  console.log(`Atlas project: ${projectId}`);

  // 2. Milestones.
  const milestoneId = new Map<string, string>();
  let mi = 0;
  for (const m of MILESTONES) {
    const values = {
      workspaceId: ws.id,
      projectId,
      name: m.name,
      description: m.desc,
      targetDate: new Date(`${m.target}T12:00:00Z`),
      sortKey: `m${String(mi).padStart(2, "0")}`,
    };
    const [existing] = await db
      .select({ id: schema.milestones.id })
      .from(schema.milestones)
      .where(and(eq(schema.milestones.projectId, projectId), eq(schema.milestones.name, m.name)))
      .limit(1);
    if (existing) {
      await db.update(schema.milestones).set(values).where(eq(schema.milestones.id, existing.id));
      milestoneId.set(m.key, existing.id);
    } else {
      const [created] = await db.insert(schema.milestones).values(values).returning({ id: schema.milestones.id });
      milestoneId.set(m.key, created.id);
    }
    mi++;
  }
  console.log(`Milestones: ${milestoneId.size}`);

  // 3. Features (+ specs) and a small starter issue backlog.
  const [{ value: issueNo }] = await db
    .select({ value: max(schema.issues.number) })
    .from(schema.issues)
    .where(and(eq(schema.issues.workspaceId, ws.id), eq(schema.issues.projectId, projectId)));
  let nextNumber = (issueNo ?? 0) + 1;
  let fi = 0;
  let featCount = 0;
  let issueCount = 0;
  for (const f of FEATURES) {
    const spec = docNode(p(f.intro), h(2, "Requirements"), bullets(f.reqs));
    const values = {
      workspaceId: ws.id,
      projectId,
      milestoneId: milestoneId.get(f.milestone) ?? null,
      title: f.title,
      status: f.status,
      startDate: new Date(`${f.start}T12:00:00Z`),
      targetDate: new Date(`${f.target}T12:00:00Z`),
      spec,
      sortKey: `a${String(fi).padStart(2, "0")}`,
    };
    let [feat] = await db
      .select({ id: schema.features.id })
      .from(schema.features)
      .where(and(eq(schema.features.projectId, projectId), eq(schema.features.title, f.title)))
      .limit(1);
    if (feat) {
      await db.update(schema.features).set({ ...values, updatedAt: new Date() }).where(eq(schema.features.id, feat.id));
    } else {
      [feat] = await db.insert(schema.features).values(values).returning({ id: schema.features.id });
    }
    featCount++;
    fi++;

    for (const iss of f.issues ?? []) {
      const [exists] = await db
        .select({ id: schema.issues.id })
        .from(schema.issues)
        .where(and(eq(schema.issues.projectId, projectId), eq(schema.issues.title, iss.title)))
        .limit(1);
      if (exists) continue;
      await db.insert(schema.issues).values({
        workspaceId: ws.id,
        projectId,
        featureId: feat.id,
        number: nextNumber++,
        title: iss.title,
        status: iss.status,
        priority: "none",
        creatorId: ownerId,
        sortKey: `a${Date.now()}${issueCount}`,
      });
      issueCount++;
    }
  }
  console.log(`Features: ${featCount} · starter issues: ${issueCount}`);

  // 4. Docs.
  async function upsertPage(title: string, icon: string, content: Node, position: string) {
    const [existing] = await db
      .select({ id: schema.pages.id })
      .from(schema.pages)
      .where(
        and(
          eq(schema.pages.workspaceId, ws.id),
          eq(schema.pages.projectId, projectId),
          eq(schema.pages.title, title),
          isNull(schema.pages.deletedAt),
        ),
      )
      .limit(1);
    const values = {
      workspaceId: ws.id,
      projectId,
      title,
      icon,
      content,
      contentText: plain(content).slice(0, 20000),
      creatorId: ownerId,
      position,
    };
    if (existing) await db.update(schema.pages).set(values).where(eq(schema.pages.id, existing.id));
    else await db.insert(schema.pages).values(values);
  }
  let di = 0;
  for (const d of DOCS) {
    await upsertPage(d.title, d.icon, docNode(...d.nodes), `a${String(di).padStart(2, "0")}`);
    di++;
  }
  console.log(`Docs: ${DOCS.length}`);

  console.log("Done — Atlas seeded.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
