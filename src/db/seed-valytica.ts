import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq, max } from "drizzle-orm";

import { db, schema } from "./index";

/**
 * Seed the Valytica product roadmap into the Gnanalytica hub: people (members +
 * People DB rows), a Valytica initiative, monthly cycles, the phased Feature
 * roadmap (completed Dec 2025 → Jun 2026 + future), and the tickets under each
 * phase — grounded in the real Valytica codebase but stretched over 7 months.
 *
 * Idempotent: re-running skips anything already present. Run: npm run db:seed-valytica
 */

// ---- people ----
type Person = {
  email: string;
  name: string;
  role: string;
  entity: "India" | "Netherlands" | "Global";
  type: "Employee" | "Contractor";
  color: string;
  admin?: boolean;
  pod?: boolean; // member of the Products pod
};

const PEOPLE: Person[] = [
  { email: "sandeep@gnanalytica.com", name: "Sandeep", role: "CEO / CTO / HR / Head of AI", entity: "Global", type: "Employee", color: "#5e6ad2", admin: true, pod: true },
  { email: "jayasaagar@gnanalytica.com", name: "Jayasaagar", role: "Chief Marketing & Product", entity: "Global", type: "Employee", color: "#0ea5e9", admin: true, pod: true },
  { email: "aparna@gnanalytica.com", name: "Aparna", role: "Business Analyst & Product Owner — Valytica", entity: "India", type: "Employee", color: "#a855f7", pod: true },
  { email: "sanjana@gnanalytica.com", name: "Sanjana", role: "AI Engineer", entity: "India", type: "Employee", color: "#10b981", pod: true },
  { email: "raunak@gnanalytica.com", name: "Raunak", role: "Full Stack Engineer", entity: "India", type: "Employee", color: "#f59e0b", pod: true },
  { email: "harshith@gnanalytica.com", name: "Harshith", role: "Infrastructure & Backend Engineer", entity: "India", type: "Employee", color: "#ef4444", pod: true },
  { email: "shravani@gnanalytica.com", name: "Shravani", role: "Marketing & Social Media Outreach", entity: "Global", type: "Employee", color: "#ec4899" },
  { email: "gpranavaditya@gmail.com", name: "Pranav Aditya", role: "Data Security Consultant", entity: "Global", type: "Contractor", color: "#64748b" },
  { email: "shraddhabollapragada@gmail.com", name: "Shraddha BLS", role: "AI Consultant", entity: "Global", type: "Contractor", color: "#8b5cf6" },
  { email: "ksnmanjusha1804@gmail.com", name: "Manjusha Ksn", role: "Lawyer & Legal Specialist", entity: "Global", type: "Contractor", color: "#0891b2" },
  { email: "bsairam.2002@gmail.com", name: "Sairam Bollapragada", role: "Delivery & Technology Transformation Consultant", entity: "Global", type: "Contractor", color: "#d97706" },
];

// short key (used in tickets) -> email
const KEY: Record<string, string> = {
  sandeep: "sandeep@gnanalytica.com",
  jay: "jayasaagar@gnanalytica.com",
  aparna: "aparna@gnanalytica.com",
  sanjana: "sanjana@gnanalytica.com",
  raunak: "raunak@gnanalytica.com",
  harshith: "harshith@gnanalytica.com",
  shravani: "shravani@gnanalytica.com",
  pranav: "gpranavaditya@gmail.com",
  shraddha: "shraddhabollapragada@gmail.com",
  manjusha: "ksnmanjusha1804@gmail.com",
  sairam: "bsairam.2002@gmail.com",
};

type FeatureStatus = "idea" | "planned" | "building" | "shipped";
type IssueStatus = "backlog" | "todo" | "in_progress" | "in_review" | "done";

type Ticket = [title: string, who: string, status?: IssueStatus];
type Phase = {
  title: string;
  desc: string;
  status: FeatureStatus;
  start: string;
  target: string;
  owner: string;
  tickets: Ticket[];
};

const PHASES: Phase[] = [
  {
    title: "Foundation & Auth",
    desc: "Supabase Postgres (Mumbai) + Auth, the initial domain schema, RLS isolation, and role-based access for the firm workspace.",
    status: "shipped",
    start: "2025-12-01",
    target: "2025-12-23",
    owner: "harshith",
    tickets: [
      ["Initial Supabase schema: orgs, profiles, cases, documents, valuations", "harshith"],
      ["Email OTP sign-in via AWS SES Mumbai + unified /sign-in page", "raunak"],
      ["auth_org_id() SECURITY DEFINER helper + qualify function search paths", "harshith"],
      ["RLS policies on core tables with per-org isolation", "harshith"],
      ["Role enum (owner/admin/valuer/case_manager/surveyor/viewer) + gating", "raunak"],
      ["profiles table + handle_new_user() auto-creation trigger", "harshith"],
      ["Storage buckets (case-documents, site-photos) with RLS", "harshith"],
      ["Security review: RLS coverage + service-role key handling", "pranav"],
      ["3-step onboarding wizard (account type → firm → state/city)", "raunak"],
      ["Vercel bom1 deployment config + env vars", "harshith"],
    ],
  },
  {
    title: "Case Lifecycle & Documents",
    desc: "Valuation case management aligned to IBA/IBBI — creation wizard, document handling, the 14-section report structure, and readiness scoring.",
    status: "shipped",
    start: "2025-12-23",
    target: "2026-01-24",
    owner: "aparna",
    tickets: [
      ["IBA/IBBI schema alignment: asset_class, asset_subclass, 14-section report", "aparna"],
      ["3-step case creation wizard (property type → purpose → client)", "raunak"],
      ["Case document uploader with document-type enum", "raunak"],
      ["Cases list: status filter, sorting, readiness badge", "raunak"],
      ["Case detail tabs (Overview, Documents, Valuation, Report, Activity)", "raunak"],
      ["47-item site-visit checklist (IBA/SBI aligned) with evidence photos", "aparna"],
      ["Per-state expected-documents checklist", "aparna"],
      ["Readiness score (0–100) from document checklist", "raunak"],
      ["Reference panel (Documents | Map) as mobile bottom sheet", "raunak"],
    ],
  },
  {
    title: "Auth Extensions & Mobile Foundation",
    desc: "Google OAuth + phone OTP (MSG91), and the Expo Android surveyor field app with GPS, geofence, checklist and camera.",
    status: "shipped",
    start: "2026-01-24",
    target: "2026-02-18",
    owner: "raunak",
    tickets: [
      ["Supabase Google OAuth + /auth/callback session exchange", "raunak"],
      ["Phone OTP via MSG91 Send SMS Hook (DLT branded)", "harshith"],
      ["E.164 phone normalization + 6-digit verification flow", "raunak"],
      ["Scaffold Expo app (SDK 56, EAS Preview/Production)", "harshith"],
      ["Mobile auth screen (email/phone/Google) with PKCE deep link", "raunak"],
      ["Surveyor invite links + phone-only onboarding", "aparna"],
      ["Mobile site-visit screen (GPS map, geofence, checklist, camera)", "raunak"],
      ["EAS CI/CD for Android APK/AAB builds", "harshith"],
    ],
  },
  {
    title: "AI Extraction & Suggestion Review",
    desc: "Gemini multimodal field extraction via the Vercel AI Gateway, with an Accept/Edit/Reject review UI, confidence-gated auto-apply and per-org metering.",
    status: "shipped",
    start: "2026-02-18",
    target: "2026-03-12",
    owner: "sanjana",
    tickets: [
      ["AI client wrapper routing all calls via Vercel AI Gateway (BYOK)", "sanjana"],
      ["extractFieldsFromFile: Gemini multimodal field extraction", "sanjana"],
      ["Suggestion review UI: value + confidence + source + Accept/Edit/Reject", "raunak"],
      ["Auto-apply high-confidence (≥0.8) fields with lock + badge", "sanjana"],
      ["Per-org AI usage metering via record_ai_usage RPC", "harshith"],
      ["ai_field_observations + deterministic cross-doc conflict detection", "sanjana"],
      ["applied_via audit column (auto/user) + RLS on ai_extracted_fields", "harshith"],
      ["Extraction model selection + prompt design review", "shraddha"],
      ["Quota scaffolding (QUOTA_MODE warn/enforce, PLAN_AI_BUDGET_INR)", "harshith"],
    ],
  },
  {
    title: "State Portal Checks & Verification",
    desc: "Assisted-mode government portal checks (Kaveri, e-Swathu, Bhoomi) with captcha solving, evidence storage, rate limiting and a verification workflow.",
    status: "shipped",
    start: "2026-03-12",
    target: "2026-04-02",
    owner: "harshith",
    tickets: [
      ["Portal-checks adapter interface + per-state registry", "harshith"],
      ["Kaveri guideline-value adapter (property value baselines)", "sanjana"],
      ["e-Swathu Form 9/11 adapter with 2Captcha integration", "harshith"],
      ["Bhoomi assisted-mode adapter (RTC link, manual submit)", "harshith"],
      ["Per-org rate limiting on portal-check runs", "harshith"],
      ["Evidence-store helper (keyed by case, Storage upload)", "harshith"],
      ["PortalChecksList UI + assisted-session modal", "raunak"],
      ["Legal review: portal ToS + assisted-mode compliance", "manjusha"],
      ["Daily cron to purge expired assisted sessions", "harshith"],
    ],
  },
  {
    title: "Valuation Engine & Maps",
    desc: "Three-method valuation (cost, market-comparable with CMA, income), measurements sheet, purpose-driven basis of value, and interactive maps with geocoding.",
    status: "shipped",
    start: "2026-04-02",
    target: "2026-04-28",
    owner: "aparna",
    tickets: [
      ["Valuation schema (cost/comparable/income + primary method)", "aparna"],
      ["Cost-approach calculator (land + depreciated building)", "raunak"],
      ["Market-comparable workflow with CMA adjustments", "raunak"],
      ["Income-method calculator (rent → net → capitalized value)", "raunak"],
      ["Comparable search via pgvector (768-dim, org-scoped)", "sanjana"],
      ["Measurements sheet (room L×W → carpet/built-up/super-built-up)", "raunak"],
      ["Purpose-driven basis of value (loan, SARFAESI, capital gains)", "aparna"],
      ["Map adapter (Google default, Mappls opt-in) + draggable pins", "raunak"],
      ["Geocoding route (Mappls + Google fallback, source precedence)", "harshith"],
    ],
  },
  {
    title: "Reports, Billing & Observability",
    desc: "React-PDF 14-section reports, .docx bank-template AI-fill, wallet billing (₹200/report) via Razorpay, field-provenance audit, and Sentry/PostHog.",
    status: "shipped",
    start: "2026-04-20",
    target: "2026-05-14",
    owner: "raunak",
    tickets: [
      ["React-PDF renderer with 14-section IBA structure", "raunak"],
      ["docxtemplater: .docx template upload + AI-fill (SBI format)", "sanjana"],
      ["Report-fill audit (per-field provenance rollup)", "raunak"],
      ["charge_org_for_report RPC: atomic wallet debit (₹200)", "harshith"],
      ["Razorpay wallet recharge: order + checkout.js + webhook", "harshith"],
      ["Report finalize workflow (lock fields, compute final value)", "raunak"],
      ["Sentry EU + PostHog EU (env-gated observability)", "harshith"],
      ["Billing transaction history + wallet audit trail", "raunak"],
      ["DPDP review: billing PII + payment data handling", "manjusha"],
    ],
  },
  {
    title: "Project Engagements — TEV / LIE / DPR",
    desc: "Beyond valuations: TEV (L1 line items + L2 formula engine), LIE recurring monitoring, DPR generation, multi-stage workflows and asset-class taxonomy.",
    status: "shipped",
    start: "2026-05-05",
    target: "2026-05-30",
    owner: "sairam",
    tickets: [
      ["engagement_type enum (valuation/tev/lie) + category mapping", "aparna"],
      ["Engagement schema (financial_model JSONB, stages, deliverables)", "harshith"],
      ["TEV L1 line-item templates (agro/trading starter packs)", "aparna"],
      ["TEV L2 declarative formula engine (no eval, cost/revenue drivers)", "sanjana"],
      ["LIE recurring-monitoring model (periodic reports, renewals)", "raunak"],
      ["Multi-stage workflow UI (carry-forward, per-stage report)", "raunak"],
      ["DPR generation + AI extraction from project reports", "sanjana"],
      ["Delivery framework: engagement playbooks + QA gates", "sairam"],
      ["Cadastral boundary overlay (import/preview/save)", "harshith"],
    ],
  },
  {
    title: "AI Autopilot, RAG & Grounding",
    desc: "Agentic orchestrator with a valuation tool set, a 7-stage autopilot pipeline, pgvector comparables retrieval, narrative grounding checks and an eval harness.",
    status: "shipped",
    start: "2026-05-20",
    target: "2026-06-14",
    owner: "sanjana",
    tickets: [
      ["Agent orchestrator: multi-step tools + SSE streaming (4-turn cap)", "sanjana"],
      ["Tool set: read_document, propose_field, run_digital_check, compute_valuation", "sanjana"],
      ["Autopilot pipeline (7 stages, ≤6 LLM calls, abort-isolated)", "sanjana"],
      ["pgvector comparables (text-embedding-005, org-scoped RLS)", "harshith"],
      ["Narrative grounding check ([verify: …] markers for unsupported claims)", "shraddha"],
      ["Objection responder (evidence-grounded reviewer replies)", "sanjana"],
      ["Extraction eval harness (golden set, baseline 98.4% / 0 hallucinations)", "shraddha"],
      ["AI cost controls: metering dashboard + per-org budget quotas", "harshith"],
      ["Case triage (deterministic urgency + next-action)", "raunak"],
    ],
  },
  {
    title: "Architecture Polish & Data Retention",
    desc: "IVS-aligned taxonomy refactor, two-pane wizard, self-service account/org deletion with a 30-day grace window, retention-purge cron and bulk case actions.",
    status: "building",
    start: "2026-06-05",
    target: "2026-06-30",
    owner: "sairam",
    tickets: [
      ["IVS-aligned engagement/asset-class taxonomy refactor", "aparna", "done"],
      ["Two-pane wizard (sticky stepper rail + live summary)", "raunak", "done"],
      ["request_account_deletion / request_org_deletion RPCs (30-day grace)", "harshith", "done"],
      ["DPDP retention policy + deletion legal sign-off", "manjusha", "done"],
      ["retention-purge cron (soft-delete → anonymize/hard-delete)", "harshith", "in_progress"],
      ["Storage cascade cleanup (documents, photos, evidence, signatures)", "harshith", "in_progress"],
      ["Multi-select + bulk actions on cases (export CSV, set status, delete)", "raunak", "in_review"],
      ["AI usage metering dashboard (monthly rollup + cost estimate)", "raunak", "todo"],
      ["Interactive architecture diagram (HTML + technical-details toggle)", "sandeep", "todo"],
    ],
  },
  // ---- future ----
  {
    title: "Bank & Enterprise Features",
    desc: "DPDP-grade in-country AI (Vertex AI Mumbai), bank vendor onboarding, bulk imports, subscription billing, SSO and custom report branding for enterprise customers.",
    status: "planned",
    start: "2026-07-01",
    target: "2026-08-29",
    owner: "sandeep",
    tickets: [
      ["Migrate AI to Vertex AI Mumbai (in-country, bank procurement)", "sanjana"],
      ["Bank integration layer: bulk case import + report download API", "harshith"],
      ["Subscription billing (free/individual/team/business/enterprise)", "raunak"],
      ["Enterprise SSO (SAML/OIDC, domain claim, auto-provisioning)", "harshith"],
      ["Custom report branding (logo, footer, watermark, signature)", "raunak"],
      ["Security & DPDP audit pack for bank vendor onboarding", "pranav"],
      ["Compliance reporting (IBBI audit trail, retention proof)", "manjusha"],
    ],
  },
  {
    title: "AI RAG & Comparables Depth",
    desc: "Full-document-text persistence, page-level citations, title-chain reasoning, and a finalize-time comparable index for deeper retrieval across firm history.",
    status: "planned",
    start: "2026-08-15",
    target: "2026-10-17",
    owner: "sanjana",
    tickets: [
      ["Persist extracted document text + page-level chunks for citations", "sanjana"],
      ["buildCaseCorpus(): full text + structured facts + valuation", "sanjana"],
      ["Recursive title-chain reasoning (parent_document_id ownership)", "sanjana"],
      ["comparable_index embeddings on report finalize", "harshith"],
      ["pgvector ANN query (pre-filter by state/subclass, cosine rank)", "sanjana"],
      ["Backfill embeddings for existing finalized cases", "harshith"],
    ],
  },
  {
    title: "Advanced Analytics & Insights",
    desc: "Portfolio dashboards, valuation-distribution analytics, risk scoring, team performance, market bulletins and scheduled exports.",
    status: "idea",
    start: "2026-10-01",
    target: "2026-12-19",
    owner: "aparna",
    tickets: [
      ["Portfolio overview dashboard (status, revenue, utilization)", "raunak"],
      ["Valuation distribution analytics (state, asset class, method)", "sanjana"],
      ["Risk-scoring model (guidance gap, method divergence, outliers)", "shraddha"],
      ["Team performance dashboard (cases/valuer, speed, revisions)", "aparna"],
      ["Scheduled export builder (CSV/Excel/PDF + email delivery)", "raunak"],
      ["Monthly market-insight bulletin + peer benchmarking", "shravani"],
    ],
  },
];

const PRIORITY_CYCLE = ["high", "medium", "medium", "low", "none", "medium", "high", "low"];

const tipDoc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const d = (s: string) => new Date(`${s}T12:00:00Z`);
const monthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

async function main() {
  const [ws] = await db
    .select({ id: schema.workspaces.id })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.slug, "gnanalytica"))
    .limit(1);
  if (!ws) {
    console.log("No gnanalytica workspace. Run db:seed-org first.");
    return;
  }

  const [project] = await db
    .select({ id: schema.projects.id, initiativeId: schema.projects.initiativeId })
    .from(schema.projects)
    .where(and(eq(schema.projects.workspaceId, ws.id), eq(schema.projects.name, "Valytica")))
    .limit(1);
  if (!project) {
    console.log("No Valytica project found.");
    return;
  }

  // ---- 1. People: users + workspace members + pod members ----
  const userId: Record<string, string> = {};
  for (const p of PEOPLE) {
    let [u] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, p.email))
      .limit(1);
    if (!u) {
      [u] = await db
        .insert(schema.users)
        .values({ name: p.name, email: p.email, avatarColor: p.color })
        .returning({ id: schema.users.id });
    } else {
      await db.update(schema.users).set({ name: p.name }).where(eq(schema.users.id, u.id));
    }
    userId[p.email] = u.id;
    await db
      .insert(schema.workspaceMembers)
      .values({ workspaceId: ws.id, userId: u.id, role: p.admin ? "admin" : "member" })
      .onConflictDoNothing();
  }
  console.log(`People: ${PEOPLE.length} ensured.`);

  // ---- People database rows ----
  const [peopleDb] = await db
    .select({ id: schema.databases.id })
    .from(schema.databases)
    .where(and(eq(schema.databases.workspaceId, ws.id), eq(schema.databases.name, "People")))
    .limit(1);
  if (peopleDb) {
    const fields = await db
      .select({ id: schema.databaseFields.id, name: schema.databaseFields.name })
      .from(schema.databaseFields)
      .where(eq(schema.databaseFields.databaseId, peopleDb.id));
    const fid = (n: string) => fields.find((f) => f.name === n)?.id;
    const existing = await db
      .select({ values: schema.databaseRows.values })
      .from(schema.databaseRows)
      .where(eq(schema.databaseRows.databaseId, peopleDb.id));
    const nameKey = fid("Name");
    const haveNames = new Set(
      existing.map((r) => (nameKey ? (r.values as Record<string, unknown>)?.[nameKey] : null)),
    );
    let pos = existing.length;
    for (const p of PEOPLE) {
      if (haveNames.has(p.name)) continue;
      const values: Record<string, unknown> = {};
      const set = (n: string, v: unknown) => {
        const id = fid(n);
        if (id) values[id] = v;
      };
      set("Name", p.name);
      set("Role", p.role);
      set("Entity", p.entity);
      set("Type", p.type);
      await db
        .insert(schema.databaseRows)
        .values({ databaseId: peopleDb.id, position: `a${pos++}`, values });
    }
    console.log("People DB rows ensured.");
  }

  // ---- 2. Valytica initiative ----
  let [initiative] = await db
    .select({ id: schema.initiatives.id })
    .from(schema.initiatives)
    .where(and(eq(schema.initiatives.workspaceId, ws.id), eq(schema.initiatives.name, "Valytica")))
    .limit(1);
  if (!initiative) {
    [initiative] = await db
      .insert(schema.initiatives)
      .values({ workspaceId: ws.id, name: "Valytica", color: "#6366f1" })
      .returning({ id: schema.initiatives.id });
  }
  await db
    .update(schema.projects)
    .set({ initiativeId: initiative.id })
    .where(eq(schema.projects.id, project.id));

  // ---- 3. Cycles (monthly, Dec 2025 → Sep 2026) ----
  const cycleByMonth: Record<string, string> = {};
  const existingCycles = await db
    .select({ id: schema.cycles.id, name: schema.cycles.name, number: schema.cycles.number })
    .from(schema.cycles)
    .where(eq(schema.cycles.workspaceId, ws.id));
  let cycleNum = existingCycles.reduce((m, c) => Math.max(m, c.number), 0);
  for (let i = 0; i < 10; i++) {
    const start = new Date(Date.UTC(2025, 11 + i, 1)); // Dec 2025 + i
    const end = new Date(Date.UTC(2025, 11 + i + 1, 0)); // last day of month
    const name = start.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
    const key = monthKey(start);
    let c = existingCycles.find((x) => x.name === name);
    if (!c) {
      const [created] = await db
        .insert(schema.cycles)
        .values({ workspaceId: ws.id, name, number: ++cycleNum, startDate: start, endDate: end })
        .returning({ id: schema.cycles.id, name: schema.cycles.name, number: schema.cycles.number });
      c = created;
    }
    cycleByMonth[key] = c.id;
  }
  console.log("Cycles ensured (Dec 2025 → Sep 2026).");

  // ---- 4. Features (phases) + 5. Issues ----
  const existingFeatures = await db
    .select({ title: schema.features.title })
    .from(schema.features)
    .where(eq(schema.features.projectId, project.id));
  const haveFeature = new Set(existingFeatures.map((f) => f.title));

  const [{ value: maxNum }] = await db
    .select({ value: max(schema.issues.number) })
    .from(schema.issues)
    .where(and(eq(schema.issues.workspaceId, ws.id), eq(schema.issues.projectId, project.id)));
  let issueNum = maxNum ?? 0;
  const creatorId = userId["sandeep@gnanalytica.com"];

  let featureCount = 0;
  let issueCount = 0;
  for (let pi = 0; pi < PHASES.length; pi++) {
    const ph = PHASES[pi];
    if (haveFeature.has(ph.title)) continue;
    const start = d(ph.start);
    const target = d(ph.target);
    const [feature] = await db
      .insert(schema.features)
      .values({
        workspaceId: ws.id,
        projectId: project.id,
        title: ph.title,
        status: ph.status,
        startDate: start,
        targetDate: target,
        spec: tipDoc(ph.desc),
        ownerId: userId[KEY[ph.owner]] ?? null,
        sortKey: `a${String(pi).padStart(2, "0")}`,
      })
      .returning({ id: schema.features.id });
    featureCount++;

    const n = ph.tickets.length;
    const span = target.getTime() - start.getTime();
    for (let ti = 0; ti < n; ti++) {
      const [title, who, explicitStatus] = ph.tickets[ti];
      const createdAt = new Date(start.getTime() + (span * (ti + 0.5)) / n);
      const status: IssueStatus =
        explicitStatus ??
        (ph.status === "shipped"
          ? "done"
          : ph.status === "building"
            ? "todo"
            : ti === 0
              ? "todo"
              : "backlog");
      await db.insert(schema.issues).values({
        workspaceId: ws.id,
        projectId: project.id,
        featureId: feature.id,
        cycleId: cycleByMonth[monthKey(createdAt)] ?? null,
        number: ++issueNum,
        title,
        status,
        priority: PRIORITY_CYCLE[(pi + ti) % PRIORITY_CYCLE.length],
        assigneeId: userId[KEY[who]] ?? null,
        creatorId,
        sortKey: `a${String(ti).padStart(3, "0")}`,
        createdAt,
        updatedAt: status === "done" ? target : createdAt,
      });
      issueCount++;
    }
  }

  console.log(`Valytica roadmap seeded: ${featureCount} phases, ${issueCount} tickets.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
