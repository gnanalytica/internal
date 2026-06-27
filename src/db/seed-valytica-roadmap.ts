import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq, isNull } from "drizzle-orm";

import { db, schema } from "./index";

/**
 * Seed the Valytica project roadmap into the hub, grounded in the real
 * /Users/sandeeppvn/code/valytica repo (Next.js 16 + Supabase B2B SaaS for
 * AI-assisted valuation):
 *   - Milestones (release phases) with target dates
 *   - The existing 14 features assigned to milestones + enriched specs
 *     (each spec = that feature's requirements checklist)
 *   - A "Roadmap & Requirements" Docs tree: one requirements page per milestone
 *   - Reference Docs mirroring the real repo (architecture, AI, mobile, …)
 *
 * Existing feature dates and the 117 linked issues are left untouched.
 * Idempotent (upserts by name/title). Run: npm run db:seed-valytica-roadmap
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

// ---- milestones (date-contiguous over the existing feature dates) ----
const MILESTONES: { key: string; name: string; targetDate: string; desc: string }[] = [
  { key: "m0", name: "v1.0 · Shipped", targetDate: "2026-05-30", desc: "Shipped — multi-tenant foundation & auth, case lifecycle, AI extraction & verification, multi-method valuation, reports & billing, and project engagements." },
  { key: "m1", name: "AI Orchestration & Hardening", targetDate: "2026-06-30", desc: "Agent + autopilot, RAG grounding, observability, AI cost metering, and data retention." },
  { key: "m2", name: "GTM · WhatsApp Launch", targetDate: "2026-07-31", desc: "Public landing, demo assets, and feedback / enterprise CTAs for the WhatsApp campaign." },
  { key: "m3", name: "v2.0 · Bank & Enterprise", targetDate: "2026-10-17", desc: "Bank-panel readiness — India-region AI, bank templates, subscriptions, comparables depth." },
  { key: "m4", name: "vNext · Scale & Insights", targetDate: "2026-12-19", desc: "Portfolio analytics, benchmarking, and team dashboards across the firm's history." },
];

// ---- features → milestone + requirements (grounded in the real repo) ----
const FEATURES: { title: string; milestone: string; intro: string; reqs: string[] }[] = [
  {
    title: "Foundation & Auth",
    milestone: "m0",
    intro: "The multi-tenant base every other feature sits on: identity, organisations, and row-level isolation.",
    reqs: [
      "Single sign-in page with email + SMS OTP (AWS SES Mumbai / MSG91 hook) and Google OAuth — unified for new and returning users.",
      "Org-of-one model: every user gets an organisation at signup; no NULL-org rows reach production.",
      "Row-level security on every table, scoped via the auth_org_id() helper.",
      "Simplified 4-role model: surveyor · valuer · owner · account_owner.",
      "India-only data residency: Supabase Postgres + Storage in Mumbai.",
    ],
  },
  {
    title: "Case Lifecycle & Documents",
    milestone: "m0",
    intro: "The case is the unit of work: create it, attach documents, move it through its states.",
    reqs: [
      "Case CRUD with a status machine: draft → in_progress → final → archived.",
      "Engagement types: valuation (with IVS asset class) plus project work (TEV / LIE / DPR).",
      "Document upload to Supabase Storage (Mumbai) with typed kinds (sale deed, EC, tax receipt, plan, site photo, …).",
      "Title-chain modelling via parent_document_id (GPA → deed → linked docs).",
      "Per-document extracted_text + digest cached for cheap downstream retrieval.",
    ],
  },
  {
    title: "Auth Extensions & Mobile Foundation",
    milestone: "m0",
    intro: "Extend auth across web and mobile and lay the surveyor-app groundwork.",
    reqs: [
      "PKCE OAuth + deep links shared between web and the Android app on one Supabase project.",
      "Phone captured at onboarding (profile metadata), not at signup; email stays the canonical identity.",
      "Account, profile, and team management screens.",
      "Surveyor role scaffolding for the field app.",
    ],
  },
  {
    title: "AI Extraction & Suggestion Review",
    milestone: "m0",
    intro: "Turn uploaded documents into reviewed, sourced field values — the product's core AI loop.",
    reqs: [
      "Extract 55+ case fields (location, boundaries, ownership, possession, encumbrances, survey no., measurements, guideline value) with confidence + source-document citation.",
      "Per-field state machine: empty → ai_suggested → user_accepted | user_edited | user_rejected.",
      "Deterministic cross-document conflict detection (no LLM averaging) surfaced as explicit conflict notes.",
      "Auto-apply only at ≥0.8 confidence and only into empty fields — never overwrite a human value.",
      "Per-(field, document) observations + full audit trail of every AI write and user decision.",
    ],
  },
  {
    title: "State Portal Checks & Verification",
    milestone: "m0",
    intro: "Assisted verification against state portals — deliberately human-in-the-loop, never fabricated.",
    reqs: [
      "Assisted digital checks via a run_digital_check tool (EC / registration / RERA) — results confirmed by a human.",
      "Optional captcha solving (2Captcha / AntiCaptcha) passing only captcha bytes, no PII.",
      "Evidence stored in a portal-evidence bucket and linked to the case.",
      "Portal scraping kept out of the autonomous agent (fabricating official results is unsafe).",
    ],
  },
  {
    title: "Valuation Engine & Maps",
    milestone: "m0",
    intro: "Compute a defensible value three ways, grounded in the firm's own history and a real map.",
    reqs: [
      "Three approaches: cost (construction ₹/sqft), comparable sales (CMA with time/size/location/condition adjustments), income capitalization (rent-based).",
      "Room-by-room measurement sheet (L×W×count) summing to carpet / built-up / super-built-up, with carpet < built-up < super validation.",
      "Comparable cases surfaced from the firm's history via pgvector similarity (org-scoped by RLS).",
      "Valuer picks the primary method that drives final_recommended_value; others go to reconciliation.",
      "Google Maps geocoded draggable pins + distance/area/radius tools (Mappls fallback).",
    ],
  },
  {
    title: "Reports, Billing & Observability",
    milestone: "m0",
    intro: "Produce the bank-ready deliverable and charge for it, atomically.",
    reqs: [
      "Standard PDF (React-PDF) + tagged .docx (docxtemplater) + AI-filled bank formats (SBI, …).",
      "Purpose-driven basis of value (loan origination / SARFAESI / capital gains / distress).",
      "AI-drafted narrative claim-checked against case facts; unverifiable claims marked [verify: …] before render.",
      "Report fill audit: every field traced to AI-auto / AI-accepted / user-edited / pending / rejected.",
      "Atomic ₹200-per-report wallet charge (charge_org_for_report RPC, race-safe); Razorpay checkout credits only on payment.captured.",
    ],
  },
  {
    title: "Project Engagements — TEV / LIE / DPR",
    milestone: "m0",
    intro: "Beyond single-property valuations: staged engineering engagements with financial models and chaptered reports.",
    reqs: [
      "Engagement taxonomy: TEV (techno-economic feasibility), LIE (lender's independent engineer), DPR — asset_class is NULL for project work.",
      "Staged workflow: scope → information → technical → financial → draft → review → issued.",
      "Declarative financial model (formula engine, no code execution) for projections and sensitivity.",
      "Chapter-based project reports drafted from retrieved chunks + case corpus.",
    ],
  },
  {
    title: "AI Autopilot, RAG & Grounding",
    milestone: "m1",
    intro: "The agentic layer: a guided agent, a deterministic autopilot, and grounded Q&A — all maker-checker.",
    reqs: [
      "Interactive agent (≤4 tool turns per tab) over a typed tool registry (read_document, propose_field, compute_valuation, find_similar_cases, draft_report_narrative, …).",
      "Coded 7-stage autopilot (completeness → fields → conflicts → grounding → valuation → narrative → review), ≤6 LLM calls, each stage failure-isolated.",
      "Ask: single-case RAG Q&A over docs + fields + valuation + site visit; Objection responder drafts evidence-grounded replies.",
      "Chapter synthesis with a narrative grounding review (generator → grounding reviewer → human).",
      "Deterministic anomaly detection (FMV < guideline, >25% method divergence, area-hierarchy, geofence, missing docs).",
    ],
  },
  {
    title: "Architecture Polish & Data Retention",
    milestone: "m1",
    intro: "Make it operable and compliant: observe it, meter it, and let users delete their data.",
    reqs: [
      "Sentry EU + PostHog EU wired (env-gated, no-op without keys).",
      "Per-org/month/feature AI usage metering (ai_usage) with a quota mode (warn → enforce).",
      "Self-service account + organisation deletion: 30-day soft-delete grace, cron hard-purge, recursive Storage cleanup.",
      "Multi-select + bulk actions on the cases list (export CSV, set status, assign valuer, delete).",
    ],
  },
  {
    title: "GTM & WhatsApp Launch Readiness",
    milestone: "m2",
    intro: "Everything the WhatsApp marketing launch needs to convert: a public face and inbound routing.",
    reqs: [
      "Production-ready public landing at valytica.gnanalytica.com with an on-brand logo.",
      "In-app activity & analytics page (registered users, uploads, report generations).",
      "In-app feedback form routing submissions into Support tickets.",
      "Enterprise / custom-requirements CTA (landing + footer) routing inquiries into the Sales CRM.",
      "Demo assets: extraction → AI value suggestions → report video, and a sample valuation report.",
    ],
  },
  {
    title: "Bank & Enterprise Features",
    milestone: "m3",
    intro: "What a bank panel requires before they'll route work through Valytica.",
    reqs: [
      "Migrate AI to Vertex / Bedrock Mumbai (DPDP + vendor procurement) before the first bank-panel customer.",
      "Bank-specific and firm-editable report templates.",
      "Razorpay subscriptions (recurring billing) beyond the prepaid wallet — currently stubbed.",
      "Enhanced audit trails and compliance reporting for panel review.",
    ],
  },
  {
    title: "AI RAG & Comparables Depth",
    milestone: "m3",
    intro: "Deepen retrieval quality and comparables coverage as case volume grows.",
    reqs: [
      "Title-chain reasoning and multi-document retrieval depth (per the AI retrieval design).",
      "Promote AI models off Flash-Lite once the extraction eval holds ≥98.4% with 0 hallucinations.",
      "State-aware case scaffolding (per-state checklists and pre-fill).",
      "Richer comparables sourcing (assisted; live web scraping stays out of the agent).",
    ],
  },
  {
    title: "Advanced Analytics & Insights",
    milestone: "m4",
    intro: "Turn the firm's accumulated case history into portfolio-level insight.",
    reqs: [
      "Portfolio analytics and benchmarking across the firm's comparable_index.",
      "Team dashboards (workload, turnaround time, quality).",
      "Trend and outlier insights surfaced from finalized cases.",
    ],
  },
];

// ---- reference Docs mirroring the real repo ----
const REF_DOCS: { title: string; icon: string; nodes: Node[] }[] = [
  {
    title: "Architecture Overview",
    icon: "🏛️",
    nodes: [
      h(1, "Architecture Overview"),
      p("System map for Valytica: a Next.js 16 App Router web app + Expo Android app over Supabase (Postgres, Auth, Storage) in Mumbai, with AI via the Vercel AI Gateway (Gemini)."),
      h(2, "Trust posture"),
      bullets([
        "India-only data residency (Supabase Mumbai, Vercel bom1, AWS SES Mumbai).",
        "RLS on every table; tenant isolation via auth_org_id().",
        "Human-in-the-loop AI — no autonomous execution of unsafe steps (portal results, money movement).",
      ]),
      p("Source: docs/architecture/ARCHITECTURE.md and the interactive diagrams in docs/architecture/."),
    ],
  },
  {
    title: "AI Retrieval & Grounding Design",
    icon: "🧭",
    nodes: [
      h(1, "AI Retrieval & Grounding Design"),
      p("How context is assembled and claims are kept honest."),
      bullets([
        "Case-context pipeline (long-context corpus: docs + fields + valuation + site visit).",
        "pgvector comparables search over the firm's finalized cases (org-scoped, 768-dim embeddings).",
        "Title-chain reasoning across linked documents.",
        "Narrative grounding: every drafted claim verified against case facts or marked [verify: …].",
      ]),
      p("Source: docs/ai-retrieval-design.md."),
    ],
  },
  {
    title: "AI Stack — Gemini via Vercel Gateway",
    icon: "🤖",
    nodes: [
      h(1, "AI Stack"),
      bullets([
        "All chat models pinned to Gemini 2.5 Flash-Lite during the experimental phase (promote after eval).",
        "Embeddings: text-embedding-005 (768-dim) for the comparable index.",
        "Per-org token metering in ai_usage via the record_ai_usage RPC; cost estimated from pricing.ts (reconcile with the Gateway dashboard).",
        "Migration path: Vertex / Bedrock Mumbai before the first bank-panel customer.",
      ]),
      p("Extraction eval baseline: 98.4% accuracy, 0 hallucinations (pnpm eval:extraction)."),
    ],
  },
  {
    title: "Mobile Field App (Android)",
    icon: "📱",
    nodes: [
      h(1, "Mobile Field App"),
      p("Expo SDK 56 (React Native) Android app, role-aware."),
      bullets([
        "Surveyor mode: assigned tasks, GPS + geofence check-in, IBA checklist, camera, on-device drawing, voice notes.",
        "Multilingual UI: English, Hindi, Telugu, Kannada.",
        "Same Supabase project + RLS; email OTP + Google OAuth (PKCE, deep links).",
        "Builds via EAS; package com.gnanalytica.valytica.",
      ]),
      p("Source: docs/superpowers/specs/2026-05-30-android-mobile-app-design.md."),
    ],
  },
  {
    title: "TEV / LIE Project Engagements",
    icon: "🏗️",
    nodes: [
      h(1, "TEV / LIE Project Engagements"),
      bullets([
        "Declarative financial-model formula engine (no code execution) for projections and sensitivity.",
        "Staged workflow: scope → information → technical → financial → draft → review → issued.",
        "Chapter-based reports drafted from retrieved chunks with grounding review.",
      ]),
      p("Source: docs/superpowers/specs/2026-06-11-tev-lie-l2-formula-engine-design.md."),
    ],
  },
  {
    title: "Maps & Geocoding",
    icon: "🗺️",
    nodes: [
      h(1, "Maps & Geocoding"),
      bullets([
        "Google Advanced Markers (GMAPS v3): geocoded draggable pins, distance/area/radius tools.",
        "Geofence boundary display for site-visit check-in.",
        "Mappls fallback (Phases 1–2 done; nearby amenities + Street View deferred).",
      ]),
      p("Source: docs/superpowers/specs/2026-06-06-case-map-geocode-and-tools-design.md."),
    ],
  },
  {
    title: "Billing & Wallet",
    icon: "💳",
    nodes: [
      h(1, "Billing & Wallet"),
      bullets([
        "Prepaid wallet: ₹200 per finalized report, debited atomically (charge_org_for_report RPC).",
        "Razorpay Standard Checkout; webhook credits only on payment.captured.",
        "Each org gets an initial free report; subscriptions are stubbed (Phase v2.0).",
        "AI usage costs surfaced per org on the billing page.",
      ]),
    ],
  },
  {
    title: "Data Residency & DPDP",
    icon: "🇮🇳",
    nodes: [
      h(1, "Data Residency & DPDP"),
      bullets([
        "All data stays in India: Supabase Mumbai, Vercel bom1, AWS SES Mumbai.",
        "No PII in URLs.",
        "Email is the canonical identity; phone collected at onboarding.",
        "Sub-processors disclosed in /privacy §6 (Supabase, Vercel, SES, Google, MSG91, Razorpay, Mappls, captcha).",
        "Planned: AI to Vertex / Bedrock Mumbai before first bank-panel customer.",
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

  const [project] = await db
    .select({ id: schema.projects.id, ownerId: schema.projects.ownerId })
    .from(schema.projects)
    .where(and(eq(schema.projects.workspaceId, ws.id), eq(schema.projects.name, "Valytica")))
    .limit(1);
  if (!project) return console.log("No Valytica project.");

  const [anyUser] = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  const creatorId = project.ownerId ?? anyUser?.id ?? null;

  // 1. Upsert milestones, capturing their ids by key.
  const idByKey = new Map<string, string>();
  let i = 0;
  for (const m of MILESTONES) {
    const [existing] = await db
      .select({ id: schema.milestones.id })
      .from(schema.milestones)
      .where(and(eq(schema.milestones.projectId, project.id), eq(schema.milestones.name, m.name)))
      .limit(1);
    const values = {
      workspaceId: ws.id,
      projectId: project.id,
      name: m.name,
      description: m.desc,
      targetDate: new Date(`${m.targetDate}T12:00:00Z`),
      sortKey: `m${String(i).padStart(2, "0")}`,
    };
    if (existing) {
      await db.update(schema.milestones).set(values).where(eq(schema.milestones.id, existing.id));
      idByKey.set(m.key, existing.id);
    } else {
      const [created] = await db.insert(schema.milestones).values(values).returning({ id: schema.milestones.id });
      idByKey.set(m.key, created.id);
    }
    i++;
  }
  console.log(`Milestones upserted: ${idByKey.size}`);

  // 2. Assign features to milestones + enrich their specs (requirements).
  let featAssigned = 0;
  for (const f of FEATURES) {
    const milestoneId = idByKey.get(f.milestone) ?? null;
    const spec = doc(p(f.intro), h(2, "Requirements"), bullets(f.reqs));
    const res = await db
      .update(schema.features)
      .set({ milestoneId, spec, updatedAt: new Date() })
      .where(and(eq(schema.features.projectId, project.id), eq(schema.features.title, f.title)))
      .returning({ id: schema.features.id });
    if (res.length === 0) console.log(`  ! feature not found: ${f.title}`);
    else featAssigned += res.length;
  }
  console.log(`Features assigned + specs enriched: ${featAssigned}/${FEATURES.length}`);

  // 3. Docs: upsert helper (by project + title, ignoring soft-deleted).
  async function upsertPage(
    title: string,
    icon: string,
    content: Node,
    parentId: string | null,
    position: string,
  ): Promise<string> {
    const [existing] = await db
      .select({ id: schema.pages.id })
      .from(schema.pages)
      .where(
        and(
          eq(schema.pages.workspaceId, ws.id),
          eq(schema.pages.projectId, project.id),
          eq(schema.pages.title, title),
          isNull(schema.pages.deletedAt),
        ),
      )
      .limit(1);
    const values = {
      workspaceId: ws.id,
      projectId: project.id,
      parentId,
      title,
      icon,
      content,
      contentText: plain(content).slice(0, 20000),
      creatorId,
      position,
    };
    if (existing) {
      await db.update(schema.pages).set(values).where(eq(schema.pages.id, existing.id));
      return existing.id;
    }
    const [created] = await db.insert(schema.pages).values(values).returning({ id: schema.pages.id });
    return created.id;
  }

  // 3a. Roadmap & Requirements tree: parent + one requirements page per milestone.
  const roadmapParent = await upsertPage(
    "Roadmap & Requirements",
    "🗺️",
    doc(
      h(1, "Roadmap & Requirements"),
      p("Release phases for Valytica and the requirements behind each. Per-feature requirements also live on each feature's spec in the Product roadmap."),
    ),
    null,
    "a00",
  );
  let mi = 0;
  for (const m of MILESTONES) {
    const feats = FEATURES.filter((f) => f.milestone === m.key);
    const nodes: Node[] = [h(1, m.name), p(m.desc), p(`Target: ${m.targetDate}.`)];
    for (const f of feats) {
      nodes.push(h(2, f.title));
      nodes.push(p(f.intro));
      nodes.push(bullets(f.reqs));
    }
    await upsertPage(m.name, "🎯", doc(...nodes), roadmapParent, `b${String(mi).padStart(2, "0")}`);
    mi++;
  }
  console.log(`Roadmap docs upserted: ${MILESTONES.length} milestone pages under "Roadmap & Requirements".`);

  // 3b. Reference docs (cross-cutting), mirroring the real repo.
  let ri = 0;
  for (const d of REF_DOCS) {
    await upsertPage(d.title, d.icon, doc(...d.nodes), null, `r${String(ri).padStart(2, "0")}`);
    ri++;
  }
  console.log(`Reference docs upserted: ${REF_DOCS.length}.`);

  console.log("Done — Valytica roadmap seeded.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
