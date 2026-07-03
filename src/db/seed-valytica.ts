import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq } from "drizzle-orm";

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
  console.log(`\nDone. Valytica canonical seed complete: ${MILESTONES.length} milestones, ${FEATURES.length} features.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
