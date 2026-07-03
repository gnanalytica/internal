import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq, isNull } from "drizzle-orm";

import { VALYTICA_PRICING } from "../lib/valytica-pricing";
import { db, schema } from "./index";

/**
 * Canonical seed for the Valytica product project (key=VAL):
 *   1. Sets projects.economics from valytica-pricing.ts (PAYG tier).
 *   2. Upserts 6 milestones from the 2026-07-03 grounding notes.
 *   3. Upserts 31 features from the grounding notes, each linked to its milestone.
 *
 * No issues/pages/docs — those are Task 5.
 * Idempotent: safe to re-run (select-then-insert-or-update; no duplicates).
 * No db.transaction — Neon HTTP driver; sequential awaits only.
 *
 * Run: npx tsx --env-file=.env.local src/db/seed-valytica.ts
 */

// ── Pricing (import from single source of truth; never hardcode) ──────────────
const PAYG_TIER = VALYTICA_PRICING.tiers.find((t) => t.id === "payg");
if (!PAYG_TIER || PAYG_TIER.perReport == null) {
  throw new Error("PAYG tier or its perReport is missing from VALYTICA_PRICING");
}
const PRICE_PER_UNIT = PAYG_TIER.perReport; // 175 — narrowed to number by the guard above
const COST_PER_UNIT = VALYTICA_PRICING.costPerReport; // 20

// ── TipTap document helpers ────────────────────────────────────────────────────
type Node = { type: string; attrs?: Record<string, unknown>; content?: Node[]; text?: string };
const p = (t?: string): Node => ({ type: "paragraph", content: t ? [{ type: "text", text: t }] : [] });
const h = (level: number, t: string): Node => ({
  type: "heading",
  attrs: { level },
  content: [{ type: "text", text: t }],
});
const bullets = (items: string[]): Node => ({
  type: "bulletList",
  content: items.map((t) => ({ type: "listItem", content: [p(t)] })),
});
const plain = (n: Node): string =>
  n.type === "text" ? (n.text ?? "") : (n.content ?? []).map(plain).join(" ").trim();

/** Build pricing-tier nodes from VALYTICA_PRICING (no hardcoded numbers). */
function buildPricingNodes(): Node[] {
  const nodes: Node[] = [
    h(2, "Pricing"),
    p(
      `Currency: ${VALYTICA_PRICING.currency}. Unit: ${VALYTICA_PRICING.unitLabel}. ` +
        `Unit cost (AI inference + fulfilment): ₹${VALYTICA_PRICING.costPerReport}/${VALYTICA_PRICING.unitLabel} — ~90% margin at PAYG.`,
    ),
  ];
  for (const tier of VALYTICA_PRICING.tiers) {
    const monthlyStr =
      tier.monthly === null
        ? "custom / per-deal"
        : tier.monthly === 0
          ? "no monthly fee"
          : `₹${tier.monthly}/month`;
    const priceStr =
      tier.perReport === null
        ? "custom / per-deal"
        : tier.perReport === 0
          ? "₹0 (included in allowance)"
          : `₹${tier.perReport}/${VALYTICA_PRICING.unitLabel}`;
    const allowanceNote =
      "allowance" in tier && tier.allowance != null
        ? ` | Allowance: ${tier.allowance} ${VALYTICA_PRICING.unitLabel}s free`
        : "";
    nodes.push(
      h(3, tier.name),
      bullets([
        `Audience: ${tier.audience}`,
        `Monthly: ${monthlyStr}`,
        `Per ${VALYTICA_PRICING.unitLabel}: ${priceStr}${allowanceNote}`,
        tier.blurb,
      ]),
    );
  }
  return nodes;
}

// ── Milestone definitions (from grounding notes §1) ───────────────────────────
type MilestoneDef = {
  name: string;
  description: string;
  targetDate: Date | null;
  sortKey: string;
};

const MILESTONES: MilestoneDef[] = [
  {
    name: "M1 — Self-serve Hub Foundation",
    description:
      "Core multi-tenant SaaS platform: auth, orgs, cases, documents, site visits, billing wallet, PDF reports, digital portal checks, mobile app. Live at valytica.gnanalytica.com. Migrations 2026-05-23 → 2026-06-04.",
    targetDate: new Date("2026-06-04T12:00:00Z"),
    sortKey: "a0",
  },
  {
    name: "M2 — AI Hardening",
    description:
      "Valuation completeness: income-capitalisation method + 3-method reconciliation. AI retrieval pipeline: document text persistence, pgvector comparable index, field observations, cross-doc conflict detection. Agent/autopilot, narrative grounding, report-fill audit, AI metering/quota, Sentry/PostHog. Migrations 2026-06-06 → 2026-06-15.",
    targetDate: new Date("2026-06-15T12:00:00Z"),
    sortKey: "a1",
  },
  {
    name: "M3 — Platform Maturity",
    description:
      "Multi-select bulk actions, race-safe charge_org_for_report RPC, account/org deletion with 30-day soft-delete + retention-purge cron, RLS perf indexes, org-at-signup flow, analytics dashboard, TEV/LIE formula engine. Migrations 2026-06-19 → 2026-06-28.",
    targetDate: new Date("2026-06-28T12:00:00Z"),
    sortKey: "a2",
  },
  {
    name: "M4 — GTM & AI Confidence",
    description:
      "Promote chat models off Flash-Lite; activate PostHog + Sentry env vars; subscription billing via Razorpay Subscriptions; TEV/LIE AI autopilot orchestration; DPR promotion to DB enum; mobile native Google Sign-in; L3 browser-worker portal automation; leaked-password protection; reverse-trial upgrade prompt.",
    targetDate: null,
    sortKey: "a3",
  },
  {
    name: "M5 — Bank / BYOC / Enterprise",
    description:
      "Migrate AI to Vertex Mumbai or Bedrock Mumbai for DPDP bank-vendor compliance. BYOC tenant deployment tooling. Empanelment management UI (admin). Multi-bank portal coverage beyond TG/AP/KA. Enterprise SSO, custom branding, bank bulk import API.",
    targetDate: null,
    sortKey: "a4",
  },
  {
    name: "M6 — Scale & Insights / Flywheel",
    description:
      "Telemetry flywheel: product-usage signals → roadmap feedback loop. Opt-in anonymized market-data pipeline for BYOC contracts. Hub analytics as self-serve insights for valuers beyond current /analytics dashboard.",
    targetDate: null,
    sortKey: "a5",
  },
];

// ── Feature definitions (from grounding notes §2) ────────────────────────────
type FeatureStatus = "idea" | "planned" | "building" | "shipped" | "archived";

type FeatureDef = {
  title: string;
  status: FeatureStatus;
  milestoneName: string; // must match a MILESTONES[].name exactly
  description: string;
  ownerEmail: string | null;
  sortKey: string;
};

const FEATURES: FeatureDef[] = [
  // ── M1 — Self-serve Hub Foundation ──────────────────────────────────────────
  {
    title: "Multi-tenant auth & org model",
    status: "shipped",
    milestoneName: "M1 — Self-serve Hub Foundation",
    description:
      "Email OTP + Google OAuth + Phone OTP (MSG91); onboarding wizard; org-of-one model; roles (owner/admin/valuer/case_manager/surveyor/viewer); RLS throughout. Migrations: 20260523141016, 20260601150900, 20260619162332.",
    ownerEmail: "harshith@gnanalytica.com",
    sortKey: "a00",
  },
  {
    title: "Case lifecycle management",
    status: "shipped",
    milestoneName: "M1 — Self-serve Hub Foundation",
    description:
      "Cases with engagement types (valuation/TEV/LIE/DPR); status FSM (draft→in_review→ready_for_report→report_generated→closed); bulk select/export/delete; display IDs; intake fields. Migrations: 20260523120443, 20260607163514.",
    ownerEmail: "aparna@gnanalytica.com",
    sortKey: "a01",
  },
  {
    title: "Document management & title chain",
    status: "shipped",
    milestoneName: "M1 — Self-serve Hub Foundation",
    description:
      "Multi-document upload per case; document type taxonomy; parent_document_id for title chain; extracted_text persistence; per-document chunking for retrieval. Migrations: 20260523120443, 20260610142535, 20260611082045.",
    ownerEmail: "aparna@gnanalytica.com",
    sortKey: "a02",
  },
  {
    title: "Digital portal checks",
    status: "shipped",
    milestoneName: "M1 — Self-serve Hub Foundation",
    description:
      "Semi-automated checks: Kaveri (KA land records), Eswathu (TS), Bhoomi (AP); captcha-solver integration; proof upload; field validation; rate limiting. Migrations: 20260527030247, 20260530152402, 20260611095448.",
    ownerEmail: "harshith@gnanalytica.com",
    sortKey: "a03",
  },
  {
    title: "Site visit management",
    status: "shipped",
    milestoneName: "M1 — Self-serve Hub Foundation",
    description:
      "One-per-case site visit; GPS geofencing (surveyor must be on-site); photo upload with geotag burning; photo categories; IBA checklist (subclass-conditional); claimed-vs-observed field comparison; one-page-per-case invariant. Migrations: 20260525185245, 20260608023213, 20260609185341.",
    ownerEmail: "aparna@gnanalytica.com",
    sortKey: "a04",
  },
  {
    title: "PDF report generation",
    status: "shipped",
    milestoneName: "M1 — Self-serve Hub Foundation",
    description:
      "React-PDF renderer; section registry with purpose-driven content (PURPOSE_BASIS); IBA-aligned sections; income sub-table + 3-method reconciliation; firm report templates (DOCX upload + AI merge). Migrations: 20260601082522, 20260608194139.",
    ownerEmail: "raunak@gnanalytica.com",
    sortKey: "a05",
  },
  {
    title: "Mobile app (Android)",
    status: "shipped",
    milestoneName: "M1 — Self-serve Hub Foundation",
    description:
      "Expo SDK 56 / React Native 0.85; role-split: surveyor (GPS geofence, IBA checklist, camera, voice notes, i18n en/hi/te/kn) vs full app (cases, valuation, reports, billing, analytics, map, account); EAS builds (com.gnanalytica.valytica); same Supabase project.",
    ownerEmail: "raunak@gnanalytica.com",
    sortKey: "a06",
  },
  {
    title: "Map integration",
    status: "shipped",
    milestoneName: "M1 — Self-serve Hub Foundation",
    description:
      "Google Maps (Advanced Markers, draggable pins, distance/area/radius tools, multi-marker); Mappls opt-in fallback; geocoded pin with save; provider preference per org/user. Migrations: 20260606054610-20260608074015.",
    ownerEmail: "raunak@gnanalytica.com",
    sortKey: "a07",
  },

  // ── M2 — AI Hardening ────────────────────────────────────────────────────────
  {
    title: "AI field extraction & review",
    status: "shipped",
    milestoneName: "M2 — AI Hardening",
    description:
      "Gemini multimodal extraction → ai_extracted_fields (state machine: empty→ai_suggested→user_accepted/edited/rejected); auto-apply at ≥0.8 confidence; confidence + source snippet per field; extraction eval harness (98.4% / 0 hallucinations).",
    ownerEmail: "sanjana@gnanalytica.com",
    sortKey: "b00",
  },
  {
    title: "Cross-document conflict detection",
    status: "shipped",
    milestoneName: "M2 — AI Hardening",
    description:
      "Deterministic (no-LLM) detection of field disagreements across docs; conflict notes written to ai_extracted_fields; ai_field_observations table for per-(field, doc) history. Migration: 20260610163201.",
    ownerEmail: "sanjana@gnanalytica.com",
    sortKey: "b01",
  },
  {
    title: "Photo analysis (AI vision)",
    status: "shipped",
    milestoneName: "M2 — AI Hardening",
    description:
      "Gemini multimodal: property type/floors/condition/issues/caption + claim-consistency vs case facts; sketch measurements import; voice note transcription for surveyor remarks.",
    ownerEmail: "sanjana@gnanalytica.com",
    sortKey: "b02",
  },
  {
    title: "Multi-method real estate valuation",
    status: "shipped",
    milestoneName: "M2 — AI Hardening",
    description:
      "Cost, market-comparable (CMA with adjustments), income-capitalisation; primary method → final_recommended_value; carpet/built-up/super-built-up hierarchy; measurement sheet; purpose-driven report basis. Migrations: 20260606161244, 20260606163331.",
    ownerEmail: "aparna@gnanalytica.com",
    sortKey: "b03",
  },
  {
    title: "pgvector comparable search",
    status: "shipped",
    milestoneName: "M2 — AI Hardening",
    description:
      "Per-org semantic search over firm's valued-case history; comparable_index table with HNSW index (768-dim, text-embedding-005); pre-filter by org+state+asset_subclass; used by find_similar_cases agent tool. Migration: 20260610142536.",
    ownerEmail: "sanjana@gnanalytica.com",
    sortKey: "b04",
  },
  {
    title: "AI agent / autopilot pipeline",
    status: "shipped",
    milestoneName: "M2 — AI Hardening",
    description:
      "Interactive per-tab agent (SSE stream, ≤4 tool turns); 7-stage autopilot workflow; narrative grounding check (maker-checker); anomaly detection; objection responder. Files: src/lib/ai/agent.ts, autopilot.ts, narrative-check.ts, objection.ts.",
    ownerEmail: "sanjana@gnanalytica.com",
    sortKey: "b05",
  },
  {
    title: "RAG ask-case Q&A",
    status: "shipped",
    milestoneName: "M2 — AI Hardening",
    description:
      "Grounded Q&A over a single case (docs + fields + valuation + site visit); floating AskCasePanel; doc-chunking for retrieval; long-context per-case corpus assembly (all docs fit in Gemini 1M window). Files: src/lib/ai/ask.ts, doc-retrieval.ts.",
    ownerEmail: "sanjana@gnanalytica.com",
    sortKey: "b06",
  },
  {
    title: "Report fill audit",
    status: "shipped",
    milestoneName: "M2 — AI Hardening",
    description:
      "Per-field AI provenance rollup (AI-auto/AI-accepted/edited/pending/rejected) displayed on report tab; deterministic provenance for the signed report. Files: src/lib/ai/report-fill-audit.ts. PR #42.",
    ownerEmail: "raunak@gnanalytica.com",
    sortKey: "b07",
  },
  {
    title: "AI usage metering & quota",
    status: "shipped",
    milestoneName: "M2 — AI Hardening",
    description:
      "Per-org/month/feature rollup in ai_usage; record_ai_usage RPC; per-plan INR ceilings; QUOTA_MODE defaults to 'enforce' (402 on overrun). Migration: 20260626155120. Files: src/lib/ai/metered.ts, quota.ts, pricing.ts.",
    ownerEmail: "harshith@gnanalytica.com",
    sortKey: "b08",
  },
  {
    title: "Error tracking + product analytics",
    status: "shipped",
    milestoneName: "M2 — AI Hardening",
    description:
      "Sentry EU + PostHog EU wired and env-gated (no-op until DSN/key set); no product analytics events defined beyond SPA pageviews. PR #43. Files: src/instrumentation.ts, src/components/posthog-provider.tsx.",
    ownerEmail: "harshith@gnanalytica.com",
    sortKey: "b09",
  },

  // ── M3 — Platform Maturity ───────────────────────────────────────────────────
  {
    title: "Analytics dashboard",
    status: "shipped",
    milestoneName: "M3 — Platform Maturity",
    description:
      "Real Supabase queries (no mock data); cases/site visits/AI fields/reports charts; Recharts; per-org scoped. Files: src/app/(app)/analytics/, src/lib/pdf/insights-data.ts.",
    ownerEmail: "raunak@gnanalytica.com",
    sortKey: "c00",
  },
  {
    title: "Account & org management",
    status: "shipped",
    milestoneName: "M3 — Platform Maturity",
    description:
      "Profile update (name/mobile/reg-no/state/city/RVO/COP/IBBI/signature); org settings; team member invite + remove (re-homes to org-of-one); account/org deletion (30-day soft-delete + purge cron). Migration: 20260626165402.",
    ownerEmail: "raunak@gnanalytica.com",
    sortKey: "c01",
  },
  {
    title: "Billing: wallet + PAYG",
    status: "shipped",
    milestoneName: "M3 — Platform Maturity",
    description:
      "Razorpay Standard Checkout; webhook-credited wallet; race-safe charge_org_for_report RPC (₹200/report debit); free_reports_remaining=3 (reverse-trial allowance); billing transaction history. Migrations: 20260626145533. Files: src/lib/billing.ts, src/lib/razorpay.ts.",
    ownerEmail: "harshith@gnanalytica.com",
    sortKey: "c02",
  },
  {
    title: "TEV/LIE financial model engine",
    status: "shipped",
    milestoneName: "M3 — Platform Maturity",
    description:
      "Declarative formula engine (Pratt parser, no eval()); NPV/IRR/DSCR; tev/model-engine.ts; golden eval (pnpm eval:tev-model). Files: src/lib/tev/, evals/eval-tev-model.ts.",
    ownerEmail: "sanjana@gnanalytica.com",
    sortKey: "c03",
  },

  // ── M4 — GTM & AI Confidence ─────────────────────────────────────────────────
  {
    title: "Billing: subscriptions",
    status: "building",
    milestoneName: "M4 — GTM & AI Confidence",
    description:
      "Plan types defined (free/individual/team/business/enterprise); plan-change server action stubbed (flips plan for free); Razorpay Subscriptions not yet wired. AGENTS.md open work.",
    ownerEmail: "raunak@gnanalytica.com",
    sortKey: "d00",
  },
  {
    title: "DPR engagement",
    status: "building",
    milestoneName: "M4 — GTM & AI Confidence",
    description:
      "App-level only (JSONB class_data.engagement_type); never promoted to DB enum; building blocks in src/lib/engagement.ts; no dedicated UI or report sections yet. AGENTS.md: 'Promote dpr into DB enum when DPR ships'.",
    ownerEmail: "aparna@gnanalytica.com",
    sortKey: "d01",
  },
  {
    title: "TEV/LIE AI autopilot",
    status: "building",
    milestoneName: "M4 — GTM & AI Confidence",
    description:
      "Building blocks exist (project-extract, tev engine, chapter-synthesis, lie/); agentic orchestration not built; explicitly deferred in AGENTS.md until GTM. Files: src/lib/ai/project-extract.ts, chapter-synthesis.ts, src/lib/lie/.",
    ownerEmail: "sanjana@gnanalytica.com",
    sortKey: "d02",
  },
  {
    title: "L3 portal automation (browser worker)",
    status: "building",
    milestoneName: "M4 — GTM & AI Confidence",
    description:
      "Design spec exists (2026-06-11-tier3-agent-browser-worker-design.md); agent-worker.ts shell present in src/lib/portal-checks/; no live browser automation infrastructure yet.",
    ownerEmail: "harshith@gnanalytica.com",
    sortKey: "d03",
  },
  {
    title: "Empanelment management",
    status: "building",
    milestoneName: "M4 — GTM & AI Confidence",
    description:
      "Read-only viewing works (queries workspace_members.asset_class); no admin management UI yet. File: src/components/account/empanelment-card.tsx.",
    ownerEmail: "aparna@gnanalytica.com",
    sortKey: "d04",
  },

  // ── M5 — Bank / BYOC / Enterprise ───────────────────────────────────────────
  {
    title: "BYOC / enterprise deployment",
    status: "planned",
    milestoneName: "M5 — Bank / BYOC / Enterprise",
    description:
      "No code, no config, no migrations. Product design §2.4 only. Banks need isolated tenant deployment (separate Supabase project + separate Vercel team); no infrastructure design yet.",
    ownerEmail: "sandeep@gnanalytica.com",
    sortKey: "e00",
  },
  {
    title: "Vertex Mumbai / Bedrock migration",
    status: "planned",
    milestoneName: "M5 — Bank / BYOC / Enterprise",
    description:
      "AGENTS.md: 'defer to first bank-panel customer'; currently Gemini via Vercel AI Gateway (global infra). Required for bank-vendor DPDP procurement compliance. Files: src/lib/ai/client.ts (upgrade path documented).",
    ownerEmail: "harshith@gnanalytica.com",
    sortKey: "e01",
  },

  // ── M6 — Scale & Insights / Flywheel ────────────────────────────────────────
  {
    title: "Telemetry / feedback flywheel",
    status: "planned",
    milestoneName: "M6 — Scale & Insights / Flywheel",
    description:
      "PostHog wired but zero product analytics events defined (no posthog.capture calls beyond automatic pageviews). Spec §2.5: product-usage signals → roadmap feedback loop. No code evidence beyond the provider.",
    ownerEmail: "sandeep@gnanalytica.com",
    sortKey: "f00",
  },
  {
    title: "Opt-in anonymized data pipeline",
    status: "planned",
    milestoneName: "M6 — Scale & Insights / Flywheel",
    description:
      "Spec §2.5 only; inviolable data-boundary rule is design-time only. BYOC contract data-network moat — opt-in anonymized market data pipeline. Zero code evidence.",
    ownerEmail: "sandeep@gnanalytica.com",
    sortKey: "f01",
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Find workspace
  const [ws] = await db
    .select({ id: schema.workspaces.id })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.slug, "gnanalytica"))
    .limit(1);
  if (!ws) {
    console.error("FATAL: gnanalytica workspace not found. Run db:seed-org first.");
    process.exit(1);
  }

  // 2. Find project VAL — fail loudly
  const [project] = await db
    .select({ id: schema.projects.id, name: schema.projects.name })
    .from(schema.projects)
    .where(and(eq(schema.projects.workspaceId, ws.id), eq(schema.projects.key, "VAL")))
    .limit(1);
  if (!project) {
    console.error("FATAL: project key=VAL not found. Cannot seed without an existing Valytica project.");
    process.exit(1);
  }
  console.log(`Project: "${project.name}" (VAL) — ${project.id}`);

  // 3. Set project economics from pricing module
  await db
    .update(schema.projects)
    .set({
      economics: {
        currency: VALYTICA_PRICING.currency,
        unitLabel: VALYTICA_PRICING.unitLabel,
        pricePerUnit: PRICE_PER_UNIT,
        costPerUnit: COST_PER_UNIT,
        notes: "PAYG tier; see valytica-pricing.ts",
      },
    })
    .where(eq(schema.projects.id, project.id));
  console.log(`Economics set: currency=INR, pricePerUnit=₹${PRICE_PER_UNIT}, costPerUnit=₹${COST_PER_UNIT}`);

  // 4. Build user lookup map (email → id) for feature owners
  const userRows = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users);
  const userByEmail = new Map(userRows.map((u) => [u.email, u.id]));

  // 5. Upsert milestones (select-then-insert-or-update by (projectId, name))
  const milestoneIdByName = new Map<string, string>();
  let msCreated = 0;
  let msUpdated = 0;

  for (const ms of MILESTONES) {
    const [existing] = await db
      .select({ id: schema.milestones.id })
      .from(schema.milestones)
      .where(and(eq(schema.milestones.projectId, project.id), eq(schema.milestones.name, ms.name)))
      .limit(1);

    if (existing) {
      await db
        .update(schema.milestones)
        .set({
          description: ms.description,
          targetDate: ms.targetDate,
          sortKey: ms.sortKey,
        })
        .where(eq(schema.milestones.id, existing.id));
      milestoneIdByName.set(ms.name, existing.id);
      msUpdated++;
    } else {
      const [created] = await db
        .insert(schema.milestones)
        .values({
          workspaceId: ws.id,
          projectId: project.id,
          name: ms.name,
          description: ms.description,
          targetDate: ms.targetDate,
          sortKey: ms.sortKey,
        })
        .returning({ id: schema.milestones.id });
      milestoneIdByName.set(ms.name, created.id);
      msCreated++;
    }
  }
  console.log(`Milestones: ${msCreated} created, ${msUpdated} updated (${MILESTONES.length} total).`);

  // 6. Upsert features (select-then-insert-or-update by (projectId, title))
  let ftCreated = 0;
  let ftUpdated = 0;

  for (const ft of FEATURES) {
    const milestoneId = milestoneIdByName.get(ft.milestoneName);
    if (!milestoneId) {
      console.error(`FATAL: milestone "${ft.milestoneName}" not found — cannot link feature "${ft.title}"`);
      process.exit(1);
    }

    const ownerId = ft.ownerEmail ? (userByEmail.get(ft.ownerEmail) ?? null) : null;
    if (ft.ownerEmail && !ownerId) {
      console.warn(`WARN: owner email "${ft.ownerEmail}" not found in users; feature "${ft.title}" will have no owner.`);
    }

    const spec = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: ft.description }] }],
    };

    const [existing] = await db
      .select({ id: schema.features.id })
      .from(schema.features)
      .where(and(eq(schema.features.projectId, project.id), eq(schema.features.title, ft.title)))
      .limit(1);

    if (existing) {
      await db
        .update(schema.features)
        .set({
          status: ft.status,
          milestoneId,
          spec,
          ownerId,
          sortKey: ft.sortKey,
        })
        .where(eq(schema.features.id, existing.id));
      ftUpdated++;
    } else {
      await db.insert(schema.features).values({
        workspaceId: ws.id,
        projectId: project.id,
        milestoneId,
        title: ft.title,
        status: ft.status,
        spec,
        ownerId,
        sortKey: ft.sortKey,
      });
      ftCreated++;
    }
  }
  console.log(`Features:   ${ftCreated} created, ${ftUpdated} updated (${FEATURES.length} total).`);

  // ── 7. Pages (docs) ──────────────────────────────────────────────────────────
  let pgCreated = 0;
  let pgUpdated = 0;
  const pageCreatorId =
    userByEmail.get("aparna@gnanalytica.com") ?? userByEmail.get("sandeep@gnanalytica.com") ?? null;

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
      creatorId: pageCreatorId,
      position,
    };
    if (existing) {
      await db.update(schema.pages).set(values).where(eq(schema.pages.id, existing.id));
      pgUpdated++;
      return existing.id;
    }
    const [created] = await db.insert(schema.pages).values(values).returning({ id: schema.pages.id });
    pgCreated++;
    return created.id;
  }

  // ── Page 1: Valytica Product Strategy ────────────────────────────────────────
  const strategyNodes: Node[] = [
    h(1, "Valytica Product Strategy"),
    h(2, "One-liner"),
    p(
      "An AI valuation copilot for India, run as an open-core hub-and-spoke: a self-serve product for individual valuers and small firms that doubles as a live demo and a data engine, funneling into hyper-customized BYOC deployments for banks and large firms.",
    ),
    h(2, "Positioning wedge — certified fast, not AVM"),
    p(
      "Automated valuation models (AVMs) already produce instant estimates but cannot be used for loan sanction — Indian lenders still legally require physical inspection by an empanelled valuer. The wedge is a certified, bank-accepted report produced fast:",
    ),
    bullets([
      "The empanelled valuer keeps inspection + sign-off (fully compliant).",
      "The AI collapses the desk work — extraction, verification, drafting, reformatting.",
      "A certified report lands in 2–3 days instead of the 7–14 that is the rate-limiting stage in every mortgage.",
    ]),
    p(
      "This deliberately sidesteps AVM competitors by competing on workflow speed for a lender, not on producing a faster estimate.",
    ),
    h(2, "The hub (self-serve core) — three simultaneous roles"),
    p(
      "Realistic TAM: ~3,000 IBBI-registered Land & Building valuers plus a larger uncounted pool of sub-₹2cr empanelled valuers (IBBI registration not mandatory below ₹2cr). Supply profile: 5,712 individuals vs only 118 registered entities (~48:1; non-metro-heavy, average age 49).",
    ),
    bullets([
      "Adoption: independent valuers and small firms self-serve. They are both the users and the supply of certified sign-off.",
      "Data engine: usage, behavior, and explicit feedback from every session drive the product roadmap.",
      "Living demo: the same product is the demo video / live walkthrough / free trial shown to banks and HFCs.",
    ]),
    h(2, "The spokes (BYOC / enterprise)"),
    p(
      "BYOC + hyper-customization for banks and large firms, won off the back of the hub demo + free trial. First target: affordable-housing HFCs — acute loan-TAT pain, tech-forward, gaining disbursement share, high valuations-per-rupee (small tickets), and move far faster than PSU banks.",
    ),
    p("Named profiles: Home First, Aavas, Aadhar, India Shelter, IIFL Home Finance, Aptus, Vastu."),
    h(2, "The flywheel and its one hard rule"),
    p("Hub and spokes both feed the core flywheel:"),
    bullets([
      "Product telemetry + explicit feedback — always on: feature usage, where users get stuck, model-quality/accuracy signals, bug reports, feedback.",
      "Anonymized market data — opt-in only, per BYOC contract: aggregated comparables / price signals (a potential data-network moat).",
    ]),
    p(
      "Inviolable line: customer/valuation data (properties, borrowers, figures) never leaves a BYOC tenant. Only product-usage signals and opt-in anonymized aggregates flow back. Getting this line right preserves both bank trust and the flywheel; blurring it loses the bank.",
    ),
    ...buildPricingNodes(),
    h(2, "Market grounding"),
    p(
      "Demand: 3.88M home loans originated FY24 (CRIF); ~22.6M active accounts; ~5M+ secured-property valuations/year. Valuation is the rate-limiting external step — 3–14 business days, routinely the longest single stage of a 7–30 day loan. HFCs gaining share (30% of disbursements H1FY26); affordable-housing HFCs fastest-growing (~20%+ CAGR).",
    ),
    p(
      "Why hub-and-spoke: the supply data killed the 'small/mid firm' beachhead (118 entities vs 5,712 individuals — statistically negligible). The individual valuer is a weak standalone business (small TAM, low ATP, non-metro, price-sensitive) but an excellent on-ramp, demo surface, and supply. Budget and acute pain sit with affordable-housing HFCs.",
    ),
    h(3, "Key pain points (verified)"),
    bullets([
      "Fulfilment gap: 6,176 IBBI valuers vs ~5M valuations/year → ~810 reports/valuer/year load vs manual cap of 1–2/day. AI lifts throughput to 4–6/day (3–4×).",
      "Valuation variance & compliance: avg absolute variance ~7.7% (global benchmark); >90% of appraisals biased upward; IBBI penalties ₹25k–₹5L + 3mo–2yr suspension.",
      "TAT bottleneck: 5–7 days valuation on the critical path; ROV rework adds 7–10 more days. Valytica: same-day report generation (~80%+ faster).",
      "Cost-to-serve: ~6 hrs desk work/report; 15–20% rework rate. Valytica: desk time −75% (1.5 hrs), cost ₹2,000 → ₹220.",
      "Peak-load inconsistency: month/quarter-end surge overwhelms fixed capacity; quality degrades under behavioural influences/fatigue.",
    ]),
    p(
      "Competition: SigmaValue (AI AVM + certified 3–5 day reports; IIT-B IBBI valuer founder; NASSCOM/NVIDIA-backed; empanelled with banks) is the primary competitor in the certified-report-fast lane. Valytica's wedge: workflow speed for the lender vs just faster estimation.",
    ),
  ];
  const strategyContent: Node = { type: "doc", content: strategyNodes };
  await upsertPage("Valytica Product Strategy", "🎯", strategyContent, null, "a0");

  // ── Page 2: Roadmap & Requirements (parent) ───────────────────────────────────
  const roadmapContent: Node = {
    type: "doc",
    content: [
      h(1, "Roadmap & Requirements"),
      p(
        "Six milestones from the shipped self-serve hub through enterprise/BYOC readiness and flywheel scale. Each child page details that milestone's features and requirements, grounded in the real Valytica repo (grounding notes 2026-07-03).",
      ),
      h(2, "Overview"),
      bullets([
        "M1 — Self-serve Hub Foundation (SHIPPED 2026-06-04) — core multi-tenant SaaS, billing, PDF reports, mobile.",
        "M2 — AI Hardening (SHIPPED 2026-06-15) — extraction, pgvector, autopilot, metering.",
        "M3 — Platform Maturity (SHIPPED 2026-06-28) — bulk actions, billing RPC, TEV engine, analytics.",
        "M4 — GTM & AI Confidence (UPCOMING) — model upgrades, subscriptions, autopilot orchestration, mobile enhancements.",
        "M5 — Bank / BYOC / Enterprise (PLANNED) — DPDP-compliant AI, BYOC tenant tooling, enterprise features.",
        "M6 — Scale & Insights / Flywheel (PLANNED) — telemetry flywheel, opt-in data pipeline, hub analytics.",
      ]),
    ],
  };
  const roadmapParentId = await upsertPage("Roadmap & Requirements", "🗺️", roadmapContent, null, "a1");

  // ── Pages 3–8: One child per milestone ───────────────────────────────────────
  const statusEmoji: Record<FeatureStatus, string> = {
    shipped: "✅",
    building: "🔨",
    planned: "📋",
    idea: "💡",
    archived: "🗄️",
  };
  for (const ms of MILESTONES) {
    const msFeatures = FEATURES.filter((f) => f.milestoneName === ms.name);
    const msNodes: Node[] = [
      h(1, ms.name),
      p(ms.description),
      h(2, "Features & Requirements"),
      bullets(
        msFeatures.map((f) => `${statusEmoji[f.status]} [${f.status}] ${f.title}: ${f.description}`),
      ),
    ];
    const msContent: Node = { type: "doc", content: msNodes };
    await upsertPage(ms.name, "📋", msContent, roadmapParentId, ms.sortKey);
  }

  // ── Page 9: Reference (parent) ────────────────────────────────────────────────
  const referenceContent: Node = {
    type: "doc",
    content: [
      h(1, "Reference"),
      p(
        "Technical reference for the Valytica product, mirroring real documentation from the product repo. Concise pointers; see the actual code for authoritative detail.",
      ),
      bullets([
        "Architecture & Infrastructure — stack, hosting, data residency, route conventions, storage.",
        "AI & Retrieval Design — pipeline A (long-context), B (pgvector), C (title-chain), model decisions, evals, metering.",
        "Data Model — core Supabase tables, enums, key design decisions.",
        "Mobile App (Android) — Expo SDK 56, role split, auth, EAS builds.",
      ]),
    ],
  };
  const referenceParentId = await upsertPage("Reference", "📚", referenceContent, null, "a2");

  // ── Pages 10–13: Reference children ──────────────────────────────────────────
  const refPages: { title: string; icon: string; position: string; content: Node }[] = [
    {
      title: "Architecture & Infrastructure",
      icon: "🏗️",
      position: "a0",
      content: {
        type: "doc",
        content: [
          h(1, "Architecture & Infrastructure"),
          p(
            "Source: docs/architecture/ARCHITECTURE.md, AGENTS.md stack section, vercel.json. Valytica is a Next.js 16 App Router app on Vercel + Supabase, fully hosted in India.",
          ),
          h(2, "Stack"),
          bullets([
            "Frontend + SSR: Next.js 16 (App Router, Turbopack, React 19, Tailwind v4)",
            "Hosting: Vercel, Functions pinned bom1 (Mumbai)",
            "DB / Auth / Storage: Supabase, ap-south-1 (Mumbai)",
            "AI: Google Gemini 2.5 Flash-Lite via Vercel AI Gateway (BYOK); Embeddings: text-embedding-005 (768-dim)",
            "Payments: Razorpay Standard Checkout (wallet); Subscriptions stubbed",
            "SMS OTP: MSG91 via Supabase Send SMS Hook",
            "Email: AWS SES Mumbai (custom SMTP in Supabase Auth)",
            "Maps: Google Maps Advanced Markers (default) + Mappls (opt-in)",
            "Mobile: Expo SDK 56 / React Native 0.85, EAS builds",
            "Error tracking: Sentry EU (env-gated; no DSN set yet)",
            "Product analytics: PostHog EU (env-gated; no key set yet)",
            "DNS: Cloudflare gnanalytica.com (grey cloud, DNS-only → Vercel CNAME)",
            "UI libs: Radix UI, shadcn-style, Recharts, React-PDF, react-hook-form + zod, Zustand, sonner, TanStack Query (mobile)",
          ]),
          h(2, "Data residency & DPDP"),
          p(
            "All customer data in India: Supabase ap-south-1 (Mumbai), Vercel bom1, AWS SES Mumbai. AI currently on global infra (Vercel AI Gateway / Gemini) — a gap for bank-vendor DPDP procurement. AGENTS.md: defer AI migration to first bank-panel customer.",
          ),
          h(2, "Route conventions"),
          bullets([
            "Route groups: (app) = authenticated; (public) = landing/auth",
            "API routes: src/app/api/",
            "Server actions: src/app/(app)/*/actions.ts",
            "Edge proxy: src/proxy.ts (Supabase auth middleware)",
            "Mobile deep link: valytica://auth-callback",
          ]),
          h(2, "Storage buckets (Supabase)"),
          bullets([
            "case-documents — title deeds, sale deeds, EC, approved plans, etc.",
            "site-photos — geotagged site visit photos (geotag burned at upload)",
            "portal-evidence — digital check proof screenshots",
            "report-templates — firm DOCX templates for AI merge",
            "signatures — valuer signatures for PDF reports",
          ]),
        ],
      },
    },
    {
      title: "AI & Retrieval Design",
      icon: "🤖",
      position: "a1",
      content: {
        type: "doc",
        content: [
          h(1, "AI & Retrieval Design"),
          p(
            "Source: docs/ai-retrieval-design.md, AGENTS.md AI section, src/lib/ai/. Three retrieval pipelines; one model stack; strict eval discipline.",
          ),
          h(2, "Pipeline A — Long-context per-case reasoning"),
          p(
            "All documents for a case fit in Gemini's 1M context window. No chunk retrieval for per-case tasks — the full corpus is assembled in a single prompt. Used by: extraction, autopilot (7-stage), ask-case Q&A, narrative grounding check.",
          ),
          h(2, "Pipeline B — Cross-case semantic search (pgvector)"),
          p(
            "comparable_index table: 768-dim embeddings (text-embedding-005), HNSW index, org-scoped RLS. Pre-filtered by org + state + asset_subclass. Used by find_similar_cases agent tool. Source: migration 20260610142536, src/lib/ai/comparables.ts.",
          ),
          h(2, "Pipeline C — Title-chain reasoning"),
          p(
            "Recursive SQL CTE over parent_document_id links in the documents table. No graph DB — pure SQL title-chain traversal.",
          ),
          h(2, "Model decisions"),
          bullets([
            "Extraction / vision / valuation / autopilot: Gemini 2.5 Flash-Lite (experimental). Upgrade path to Flash / Pro documented in src/lib/ai/client.ts.",
            "Embeddings: text-embedding-005 (768-dim) via Vertex AI Gateway.",
            "Stub mode: local dev without gateway key returns deterministic fixtures — no API calls in CI.",
            "Planned: Vertex Mumbai / Bedrock Mumbai migration for DPDP bank-vendor procurement (deferred to first bank customer).",
          ]),
          h(2, "Eval & quality discipline"),
          bullets([
            "Extraction eval: evals/extraction/ — 98.4% accuracy, 0 hallucinations baseline (2026-06-11).",
            "Narrative grounding check (src/lib/ai/narrative-check.ts): maker-checker before report generation.",
            "Anomaly detection + objection responder in autopilot pipeline (src/lib/ai/objection.ts).",
            "Report fill audit: per-field AI provenance rollup (AI-auto/AI-accepted/edited/pending/rejected) — src/lib/ai/report-fill-audit.ts.",
          ]),
          h(2, "Metering & quota"),
          p(
            "Per-org/month/feature rollup in ai_usage table; record_ai_usage RPC; per-plan INR ceilings enforced at 402 on overrun (QUOTA_MODE=enforce). Files: src/lib/ai/metered.ts, quota.ts, pricing.ts.",
          ),
        ],
      },
    },
    {
      title: "Data Model",
      icon: "🗃️",
      position: "a2",
      content: {
        type: "doc",
        content: [
          h(1, "Data Model"),
          p(
            "Source: supabase/migrations/ (74 migrations, 2026-05-23 → 2026-06-28). Supabase / PostgreSQL schema with RLS throughout. Multi-tenant root is organizations.",
          ),
          h(2, "Core tables"),
          bullets([
            "organizations — multi-tenant root; plan / wallet / free_reports_remaining",
            "profiles — extends auth.users; role; IBBI / COP / RVO registration fields; signature URL",
            "cases — engagement_type discriminator; asset_class + asset_subclass (IVS-aligned, nullable for non-valuation); status FSM; short NanoID opaque URL",
            "documents — file store refs; parent_document_id (title chain); extracted_text + text_extracted_at; document_chunks for RAG retrieval",
            "ai_extracted_fields — state machine (empty → ai_suggested → user_accepted / user_edited / user_rejected); applied_via provenance; source_snippet; conflict_note",
            "ai_field_observations — per-(case, field, document) extraction history for cross-doc conflict detection",
            "digital_checks — portal check state machine; proof_url",
            "site_visits — one per case; GPS coords; is_geofence_compliant; voice note; layout JSONB",
            "site_photos — geotag burned at upload; photo_category; AI vision analysis results (JSONB)",
            "valuations — 3-method (cost / market / income); comparables JSONB; measurements JSONB; primary_method; final_recommended_value",
            "comparable_index — pgvector 768-dim embeddings; HNSW index; pre-filter cols (state, asset_subclass, org)",
            "reports — status (draft / final / revised); generated_by; template reference",
            "billing_transactions — recharge / debit / credit_adjustment / refund; wallet history",
            "ai_usage — per-(org, month, feature) token + cost rollup",
            "audit_logs — entity-scoped audit trail; org-filtered",
            "rate_limits — API rate limiter state",
          ]),
          h(2, "Key enums"),
          bullets([
            "user_role: owner / admin / valuer / case_manager / surveyor / viewer",
            "india_state: all Indian states + UTs (TG, KA, AP have portal check adapters)",
            "engagement_type: valuation / tev / lie (dpr is JSONB-only, not yet a DB enum)",
            "asset_class: real_estate / plant_equipment / business_financial",
            "case_status: draft → in_review → ready_for_report → report_generated → closed",
            "ai_field_state: empty → ai_suggested → user_accepted / user_edited / user_rejected",
            "plan_type: free / individual / team / business / enterprise",
          ]),
          h(2, "Design decisions"),
          bullets([
            "RLS throughout — every table has row-level security; multi-tenancy enforced at DB layer.",
            "org-of-one model — a solo valuer creates an org with just themselves; team invite re-homes members.",
            "parent_document_id — title chain modelled as self-referential FK on documents; recursive CTE for traversal.",
            "comparable_index — per-org embeddings isolated by RLS; not shared across orgs.",
            "AI state machine — AI never overwrites a human-entered value; auto-apply only at ≥0.8 confidence into empty fields.",
          ]),
        ],
      },
    },
    {
      title: "Mobile App (Android)",
      icon: "📱",
      position: "a3",
      content: {
        type: "doc",
        content: [
          h(1, "Mobile App (Android)"),
          p(
            "Source: mobile/, AGENTS.md mobile section, docs/superpowers/specs/2026-05-30-android-mobile-app-design.md. Expo SDK 56 / React Native 0.85; same Supabase project as web.",
          ),
          h(2, "Tech stack"),
          bullets([
            "Expo SDK 56 / React Native 0.85 / React 19 + TypeScript",
            "Expo Router (file-system routing, mirrors Next.js App Router convention)",
            "Supabase JS (same project; RLS-enforced) + TanStack Query",
            "Design system: token-based StyleSheet in mobile/src/theme/ — mirrors globals.css; no NativeWind",
            "EAS builds: package com.gnanalytica.valytica; preview (APK) + production (Play AAB)",
          ]),
          h(2, "Role split"),
          bullets([
            "(surveyor) route group — simplified field app: GPS geofencing (on-site enforcement), IBA checklist (subclass-conditional), camera + geotagged photos, voice notes (transcribed via /api/ai/transcribe), i18n (en/hi/te/kn).",
            "(app) route group — full feature set: cases, valuation, reports, billing, analytics, map, account.",
          ]),
          h(2, "Auth"),
          bullets([
            "Email OTP + Google OAuth (PKCE, browser redirect, valytica://auth-callback deep link)",
            "Shared OAuth client with web — same Supabase project; no separate auth setup",
            "Native Google Sign-in (@react-native-google-signin) deferred — AGENTS.md open work (M4)",
          ]),
          h(2, "AI bridge"),
          p(
            "Transcription endpoint (/api/ai/transcribe) accepts Supabase Bearer token — the mobile app calls the web API for AI features; no separate AI integration in the mobile bundle.",
          ),
          h(2, "Types sync"),
          p(
            "mobile/src/types/database.ts is a copy of src/types/database.ts. Regenerate together on schema changes (supabase gen types typescript).",
          ),
          h(2, "Open work (AGENTS.md)"),
          bullets([
            "Native Google Sign-in: @react-native-google-signin + Android OAuth client + SHA-1 from every EAS profile — deferred to M4.",
            "Types sync: mobile/src/types/database.ts must be kept in sync manually until automation is added.",
          ]),
        ],
      },
    },
  ];

  for (const refPage of refPages) {
    await upsertPage(refPage.title, refPage.icon, refPage.content, referenceParentId, refPage.position);
  }

  const pgTotal = pgCreated + pgUpdated;
  console.log(`Pages:      ${pgCreated} created, ${pgUpdated} updated (${pgTotal} total).`);
  console.log(`\nDone. Valytica canonical seed complete: ${MILESTONES.length} milestones, ${FEATURES.length} features, ${pgTotal} pages.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
