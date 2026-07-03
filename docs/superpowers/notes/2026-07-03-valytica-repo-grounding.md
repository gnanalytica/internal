# Valytica Repo Grounding Notes

**Date:** 2026-07-03
**Purpose:** Working notes for Tasks 4–5 — seed the hub roadmap, features, and reference docs from the real product repo. Do NOT invent. Delete after Task 5 lands.

**Repo:** `/Users/sandeeppvn/code/valytica` (branch `chore/remove-redundant-pages`)
**Spec reconciled against:** `docs/superpowers/specs/2026-07-03-valytica-product-design.md`

---

## 1. Milestones

Phase names reconciled with the spec §2 hub-and-spoke model. Dates inferred from migration timestamps (format `YYYYMMDDHHMMSS`) and PR mentions in `AGENTS.md`. Labels are not present in the repo itself — these are reconstructed for the hub roadmap.

### M1 — Self-serve Hub Foundation (SHIPPED)
**Evidence:** `supabase/migrations/20260523*` through `20260604*`, `README.md`, `AGENTS.md`
- Core multi-tenant SaaS platform (auth, orgs, cases, docs, site visits, billing wallet, PDF reports, digital portal checks)
- Live at `https://valytica.gnanalytica.com` — Vercel prod, Supabase Mumbai
- All stated as wired/live: MSG91 SMS OTP, Razorpay wallet recharge, Google OAuth, onboarding flow
- Billing: ₹200/report wallet model, free_reports_remaining=3 (reverse-trial allowance in schema), Razorpay PAYG recharge
- Migrations range: 2026-05-23 → 2026-06-04

### M2 — AI Hardening (SHIPPED)
**Evidence:** `supabase/migrations/20260606*` through `20260615*`; `AGENTS.md` PR #40, #42, #43, #48; `src/lib/ai/`; `evals/`
- Valuation completeness: income-capitalisation method + 3-method reconciliation (`20260606161244`), measurement sheet (`20260606163331`)
- AI retrieval pipeline: document text persistence (`20260610142535`), pgvector comparable index (`20260610142536`), AI field observations + cross-doc conflict detection (`20260610163201`)
- Extraction eval baseline 98.4% / 0 hallucinations (2026-06-11) — `evals/extraction/`
- AI usage metering + quota enforcement (PR #48, `20260626155120`)
- Sentry EU + PostHog EU (PR #43) — wired, env-gated (no DSN/key set yet)
- Report fill audit (PR #42)
- Agent/autopilot pipeline (`src/lib/ai/autopilot.ts`, `agent.ts`)
- Narrative grounding check (`src/lib/ai/narrative-check.ts`)
- Migrations range: 2026-06-06 → 2026-06-15

### M3 — Platform Maturity (SHIPPED, recent)
**Evidence:** `supabase/migrations/20260619*` through `20260628*`; `AGENTS.md` open-work checked items
- Multi-select bulk actions on cases list (referenced in AGENTS.md route conventions + `cases_delete` RLS policy `20260626143013`)
- `charge_org_for_report` RPC, race-safe debit (`20260626145533`)
- Account / org deletion with 30-day soft-delete grace + `retention-purge` cron (`20260626165402`)
- RLS init-plan FK indexes for perf (`20260626134803`)
- Org-at-signup flow (`20260619162332`)
- Migrations range: 2026-06-19 → 2026-06-28

### M4 — GTM & AI Confidence (UPCOMING — partially in code, partially gap)
**Evidence:** AGENTS.md "Open work / known TODOs" (unchecked items), design specs in `docs/superpowers/specs/`
- Promote chat models off Flash-Lite (extraction/vision/valuation → `gemini-2.5-flash` or Pro); requires running `pnpm eval:extraction`
- Activate PostHog + Sentry (set env vars `NEXT_PUBLIC_POSTHOG_KEY`, `SENTRY_DSN`)
- Enable Supabase leaked-password protection (dashboard toggle)
- Subscription billing via Razorpay Subscriptions (plan-change flow in `billing/actions.ts` currently stubbed)
- Project (TEV/LIE) AI autopilot orchestration (building blocks exist: `project-extract.ts`, `tev/`, `chapter-synthesis.ts`, `lie/`; agentic pipeline not orchestrated)
- DPR promotion to DB `engagement_type` enum when DPR ships
- Mobile: Native Google Sign-in (`@react-native-google-signin`) for surveyor UX
- No target date evidenced in repo

### M5 — Bank/BYOC/Enterprise (PLANNED — design only, no code)
**Evidence:** `AGENTS.md` ("bank customers are a possible future segment"; DPDP/AI migration note); product spec §2.4
- Migrate AI from Gemini/Vercel AI Gateway → Vertex Mumbai or Bedrock Mumbai for bank-vendor procurement DPDP compliance (described in AGENTS.md as "defer to first bank-panel customer")
- BYOC tenant deployment tooling (not evidenced in repo at all — pure gap)
- Empanelment management UI (`src/components/account/empanelment-card.tsx` — read-only viewing works; no admin management yet)
- Multi-bank portal coverage beyond current TG/AP/KA states (Kaveri/Eswathu/Bhoomi adapters — `src/lib/portal-checks/`)
- No migrations, no API routes, no deploy configs for BYOC

### M6 — Scale & Insights / Flywheel (PLANNED — not in repo)
**Evidence:** product spec §2.5 only; no code
- Telemetry flywheel: product-usage signals → roadmap feedback loop
- Opt-in anonymized market data pipeline for BYOC contracts
- Hub analytics as self-serve insights for valuers (beyond the current `/analytics` dashboard)
- None evidenced in repo — pure research/build gap

---

## 2. Features

Status inference: **shipped** = code + migration both present; **building** = code exists, incomplete/stubbed; **planned** = spec or design doc only, no code.

| Feature Area | Status | Description | Source |
|---|---|---|---|
| Multi-tenant auth & org model | shipped | Email OTP + Google OAuth + Phone OTP; onboarding wizard; org-of-one model; roles (owner/admin/valuer/case_manager/surveyor/viewer); RLS throughout | `AGENTS.md` auth section; migrations `20260523141016`, `20260601150900`, `20260619162332`; `src/lib/supabase/` |
| Case lifecycle management | shipped | Cases with engagement types (valuation/TEV/LIE/DPR); status FSM (draft→in_review→ready_for_report→report_generated→closed); bulk select/export/delete; display IDs; intake fields | `supabase/migrations/20260523120443`; `20260607163514`; `src/app/(app)/cases/`; `src/lib/engagement.ts` |
| Document management & title chain | shipped | Multi-document upload per case; document type taxonomy; parent_document_id for title chain; extracted_text persistence; per-document chunking | migration `20260523120443`; `20260610142535`; `20260611082045`; `src/lib/case-documents.ts`; `src/lib/document-types.ts` |
| AI field extraction & review | shipped | Gemini multimodal extraction → ai_extracted_fields (state machine: empty→ai_suggested→user_accepted/edited/rejected); auto-apply at ≥0.8 confidence; confidence + source snippet per field; extraction eval harness | `src/lib/ai/extract.ts`; `src/lib/ai/auto-apply.ts`; `evals/extraction/`; `src/app/api/ai/extract/route.ts` |
| Cross-document conflict detection | shipped | Deterministic (no-LLM) detection of field disagreements across docs; conflict notes written to `ai_extracted_fields`; `ai_field_observations` table for per-(field, doc) history | migration `20260610163201`; `src/lib/ai/field-observations.ts` |
| Digital portal checks | shipped | Semi-automated checks: Kaveri (KA land records), Eswathu (TS), Bhoomi (AP); captcha-solver integration; proof upload; field validation; rate limiting | `src/lib/portal-checks/`; migrations `20260527030247`, `20260530152402`, `20260611095448`; `src/components/cases/portal-checks/` |
| Site visit management | shipped | One-per-case site visit; GPS geofencing (surveyor must be on-site); photo upload with geotag burning; photo categories; IBA checklist (subclass-conditional); claimed-vs-observed field comparison; one-page-per-case invariant | migrations `20260525185245`, `20260608023213`, `20260609185341`; `src/lib/site-visit-checklist.ts`; `src/lib/site-visit/` |
| Photo analysis (AI vision) | shipped | Gemini multimodal: property type/floors/condition/issues/caption + claim-consistency vs case facts; sketch measurements import; voice note transcription for surveyor remarks | `src/lib/ai/vision.ts`; `src/app/api/ai/vision/route.ts`; `src/app/api/ai/transcribe/route.ts` |
| Multi-method real estate valuation | shipped | Cost, market-comparable (CMA with adjustments), income-capitalisation; primary method → final_recommended_value; carpet/built-up/super-built-up hierarchy; measurement sheet; purpose-driven report basis | migrations `20260606161244`, `20260606163331`; `src/lib/valuation-shared.ts`; `src/lib/area.ts` |
| pgvector comparable search | shipped | Per-org semantic search over firm's valued-case history; `comparable_index` table with HNSW index; pre-filter by org+state+asset_subclass; used by `find_similar_cases` agent tool | migration `20260610142536`; `src/lib/ai/comparables.ts`; `src/components/cases/similar-cases-panel.tsx` |
| AI agent / autopilot pipeline | shipped | Interactive per-tab agent (SSE stream, ≤4 tool turns); 7-stage autopilot workflow; narrative grounding check (maker-checker); anomaly detection; objection responder | `src/lib/ai/agent.ts`; `src/lib/ai/autopilot.ts`; `src/lib/ai/narrative-check.ts`; `src/lib/ai/objection.ts`; `src/app/api/ai/agent/route.ts` |
| RAG ask-case Q&A | shipped | Grounded Q&A over a single case (docs + fields + valuation + site visit); floating AskCasePanel; doc-chunking for retrieval | `src/lib/ai/ask.ts`; `src/app/api/ai/ask/route.ts`; `src/lib/ai/doc-retrieval.ts`; `src/lib/ai/doc-chunking.ts` |
| Report fill audit | shipped | Per-field AI provenance rollup (AI-auto/AI-accepted/edited/pending/rejected) displayed on report tab; deterministic provenance for the signed report | `src/lib/ai/report-fill-audit.ts`; `src/components/cases/report-fill-audit-card.tsx`; AGENTS.md PR #42 |
| PDF report generation | shipped | React-PDF renderer; section registry with purpose-driven content (PURPOSE_BASIS); IBA-aligned sections; income sub-table + 3-method reconciliation; firm report templates (DOCX upload + AI merge) | `src/lib/pdf/`; `src/lib/iba-report-sections.ts`; migrations `20260601082522`, `20260608194139` |
| AI usage metering & quota | shipped | Per-org/month/feature rollup in `ai_usage`; `record_ai_usage` RPC; per-plan INR ceilings; `QUOTA_MODE` defaults to `"enforce"` (402 on overrun) | migration `20260626155120`; `src/lib/ai/metered.ts`; `src/lib/ai/quota.ts`; `src/lib/ai/pricing.ts` |
| Billing: wallet + PAYG | shipped | Razorpay Standard Checkout; webhook-credited wallet; ₹200/report debit (race-safe RPC); free_reports_remaining=3 (reverse-trial allowance) | `AGENTS.md` billing section; `src/lib/billing.ts`; `src/lib/razorpay.ts`; migrations `20260626145533` |
| Billing: subscriptions | building | Plan types defined (free/individual/team/business/enterprise); plan-change server action stubbed; Razorpay Subscriptions not wired | `AGENTS.md` open work; `src/app/(app)/billing/`; no subscription migration |
| Analytics dashboard | shipped | Real Supabase queries (no mock data); cases/site visits/AI fields/reports charts; Recharts; per-org | `src/app/(app)/analytics/`; `src/lib/pdf/insights-data.ts` |
| Map integration | shipped | Google Maps (Advanced Markers, draggable pins, distance/area/radius tools, multi-marker); Mappls opt-in fallback; geocoded pin with save; provider preference per org/user | `src/components/map/`; `src/app/(app)/map.tsx`; migrations `20260606054610`-`20260608074015` |
| Account & org management | shipped | Profile update (name/mobile/reg-no/state/city/RVO/COP/IBBI/signature); org settings; team member invite + remove (re-homes to org-of-one); account/org deletion (30-day soft-delete + purge cron) | `src/components/account/`; `src/app/(app)/account/`; migration `20260626165402` |
| Error tracking + product analytics | shipped (env-gated) | Sentry EU + PostHog EU wired; no-op until DSN/key env vars set; no product analytics events defined beyond SPA pageviews | `src/instrumentation.ts`; `src/components/posthog-provider.tsx`; AGENTS.md PR #43 |
| Mobile app (Android) | shipped | Expo SDK 56 / React Native 0.85; role-split: surveyor (simplified field app: GPS geofence, IBA checklist, camera, voice notes, i18n en/hi/te/kn) vs full app (cases, valuation, reports, billing, analytics, map, account); EAS builds; same Supabase project | `mobile/`; `AGENTS.md` mobile section; `mobile/README.md` |
| TEV/LIE financial model engine | shipped | Declarative formula engine (Pratt parser, no eval()); NPV/IRR/DSCR; `tev/model-engine.ts`; golden eval `pnpm eval:tev-model` | `src/lib/tev/`; `evals/eval-tev-model.ts`; design spec `2026-06-11-tev-lie-l2-formula-engine-design.md` |
| DPR engagement | building | App-level only (JSONB `class_data.engagement_type`); never promoted to DB enum; building blocks in `engagement.ts`; no dedicated UI or report sections | `src/lib/engagement.ts` comment; `AGENTS.md` open work |
| TEV/LIE AI autopilot | building | Building blocks exist (project-extract, tev engine, chapter-synthesis, lie/); agentic orchestration not built; explicitly deferred in AGENTS.md until GTM | `src/lib/ai/project-extract.ts`; `src/lib/ai/chapter-synthesis.ts`; `src/lib/lie/`; AGENTS.md |
| L3 portal automation (browser worker) | building | Design spec exists (`2026-06-11-tier3-agent-browser-worker-design.md`); `src/lib/portal-checks/agent-worker.ts` shell present; no live browser automation | design spec; `src/lib/portal-checks/agent-worker.ts` |
| BYOC / enterprise deployment | planned | No code, no config, no migrations; product design §2.4 only | spec §2.4 only |
| Telemetry / feedback flywheel | planned | No code; PostHog wired but no product event instrumentation beyond pageviews; spec §2.5 only | spec §2.5 only |
| Opt-in anonymized data pipeline | planned | No code; spec §2.5 only; the inviolable data-boundary rule is design-time only | spec §2.5 only |
| Vertex Mumbai / Bedrock migration | planned | AGENTS.md: "defer to first bank-panel customer"; current: Gemini via Vercel AI Gateway (global infra) | AGENTS.md; src/lib/ai/client.ts |
| Empanelment management | building | building — read-only viewing works (queries workspace_members.asset_class); no admin management yet | `src/components/account/empanelment-card.tsx` |

---

## 3. Reference-Doc Topics

Topics that a "Reference" docs tree should mirror, grounded in real repo docs.

### R1. Architecture & Infrastructure
**Source:** `docs/architecture/ARCHITECTURE.md`, `AGENTS.md` stack section, `vercel.json`
- System architecture: Next.js 16 App Router + Vercel `bom1` (Mumbai) + Supabase `ap-south-1` (Mumbai)
- Data residency / DPDP commitment: all data in India; AI currently on global infra (gap for bank customers)
- DNS: Cloudflare zone → Vercel CNAME
- Route conventions and file-system layout (`src/proxy.ts`, route groups, naming rules)
- Storage buckets: `case-documents`, `site-photos`, `portal-evidence`, `report-templates`, `signatures`

### R2. AI & Retrieval Design
**Source:** `docs/ai-retrieval-design.md` (explicit design doc), `AGENTS.md` AI integration status section, `src/lib/ai/`
- Long-context per-case corpus assembly (A. Report-reasoning pipeline) — all docs fit in Gemini 1M window, no chunk retrieval
- pgvector comparables search (B. Cross-case semantic search) — `comparable_index` table, HNSW, org-scoped RLS
- Title-chain reasoning via recursive SQL CTE (C. No graph DB)
- AI model decisions: Gemini 2.5 Flash-Lite (experimental); upgrade path to Flash/Pro documented in `src/lib/ai/client.ts`
- Prompt and eval discipline: extraction eval (`evals/extraction/`), narrative grounding check (`narrative-check.ts`)
- Metering + quota architecture (`metered.ts`, `quota.ts`, `pricing.ts`)
- Stub mode (local dev without gateway key)
- Planned: Vertex Mumbai / Bedrock Mumbai migration for bank-DPDP compliance

### R3. Data Model (Supabase Schema)
**Source:** `supabase/migrations/` (74 migrations, 2026-05-23 → 2026-06-28)
Core tables and their purpose:
- `organizations` — multi-tenant root; plan/wallet/free_reports_remaining
- `profiles` — extends `auth.users`; role; IBBI/COP/RVO registration fields; signature
- `cases` — engagement_type discriminator; asset_class + asset_subclass (IVS-aligned, nullable for non-valuation); status FSM; short opaque URL ID (NanoID)
- `documents` — file store refs; `parent_document_id` (title chain); `extracted_text` + `text_extracted_at`; `document_chunks` for retrieval
- `ai_extracted_fields` — state machine (empty→ai_suggested→user_accepted/edited/rejected); `applied_via` provenance; `source_snippet`; `conflict_note`
- `ai_field_observations` — per-(case, field, document) extraction history for cross-doc conflict
- `digital_checks` — portal check state machine; `proof_url`
- `site_visits` — one per case; GPS coords; `is_geofence_compliant`; voice note; layout JSONB
- `site_photos` — geotag burned at upload; photo_category; AI vision analysis results
- `valuations` — 3-method (cost/market/income); `comparables` JSONB; `measurements` JSONB; `primary_method`; `final_recommended_value`
- `comparable_index` — pgvector 768-dim embeddings; HNSW index; pre-filter cols
- `reports` — status (draft/final/revised); `generated_by`; template reference
- `billing_transactions` — recharge/debit/credit_adjustment/refund; wallet history
- `ai_usage` — per-(org, month, feature) token + cost rollup
- `audit_logs` — entity-scoped audit trail; org-filtered
- `rate_limits` — API rate limiter state
- Key enums: `user_role`, `india_state`, `engagement_type` (valuation/tev/lie), `asset_class` (real_estate/plant_equipment/business_financial), `case_status`, `ai_field_state`, `plan_type`

### R4. Mobile App (Android)
**Source:** `AGENTS.md` mobile section; `mobile/`; design spec `docs/superpowers/specs/2026-05-30-android-mobile-app-design.md`
- Expo SDK 56 (React Native 0.85, React 19) + Expo Router + TypeScript
- Role split: `(surveyor)` route group (GPS geofence, IBA checklist, camera, voice notes, i18n) vs `(app)` route group (full feature set)
- Auth: Email OTP + Google OAuth (PKCE, browser redirect, `valytica://auth-callback` deep link); shared OAuth client with web
- Design system: token-based `StyleSheet` in `mobile/src/theme/` (mirrors `globals.css`; no NativeWind)
- Supabase JS (same project, RLS-enforced) + TanStack Query
- AI bridge: transcription endpoint accepts Supabase `Bearer` token (`/api/ai/transcribe`)
- EAS builds: `com.gnanalytica.valytica`; preview (APK) + production (Play AAB)
- Types: `mobile/src/types/database.ts` = copy of `src/types/database.ts` — regenerate together

### R5. Engagement Types & Report Workflows
**Source:** `src/lib/engagement.ts`; `src/lib/pdf/`; `src/lib/tev/`; `src/lib/lie/`; design specs in `docs/superpowers/specs/`
- Three engagement categories: Valuation (`valuation`), Feasibility (`tev`/`dpr`), Monitoring (`lie`)
- Valuation: 3-method real estate + income-cap; purpose-driven report (loan origination/SARFAESI/IBC/FMV); PDF via React-PDF + firm DOCX templates
- TEV: declarative formula engine (Pratt parser); NPV/IRR/DSCR; project-extract AI; chapter-synthesis
- LIE: monitoring / tranche certification (`src/lib/lie/`)
- DPR: app-level only (JSONB `class_data`); not a DB enum column yet

---

## 4. Gaps (Research / Build — not evidenced in repo)

These are items the roadmap needs per the product spec but that the repo does NOT evidence. Task 4 should seed these as `research`-type items, not fabricated features.

| Gap | Why it matters | Evidence status |
|---|---|---|
| **BYOC/enterprise deploy tooling** | Banks need isolated tenant deployment (separate Supabase project? separate Vercel team?); no infrastructure design or code | Zero evidence — spec §2.4 only |
| **Telemetry / product flywheel instrumentation** | PostHog wired but zero product analytics events defined; no signals → roadmap feedback loop | PostHog provider exists; no `posthog.capture()` calls in `src/` beyond pageviews |
| **Opt-in anonymized market-data pipeline** | BYOC contract data-network moat; spec §2.5; inviolable data-boundary rule is design-time only | Zero code evidence |
| **Vertex Mumbai / Bedrock Mumbai AI migration** | Required for bank-vendor DPDP procurement; currently Gemini via Vercel AI Gateway (global infra) | AGENTS.md explicitly deferred; no migration plan in repo |
| **Razorpay Subscriptions (plan billing)** | Firm-plan recurring billing; plan-change server action exists but is stubbed (flips plan for free) | `AGENTS.md` open work; `billing/actions.ts` confirmed stubbed |
| **Reverse-trial upgrade prompt / paywall UI** | `free_reports_remaining=3` exists in schema and is debited; no UI prompt when it hits zero, no upgrade CTA | Schema column present; no UI component checking exhaustion |
| **Subscription / pricing page end-to-end** | No pricing page in routes beyond `/billing` (which shows wallet + AI usage) | Route table in AGENTS.md; no `/pricing` page evident |
| **Native Google Sign-in for mobile (Android)** | Better surveyor UX (one-tap picker); deferred; needs `@react-native-google-signin` + Android OAuth client + SHA-1 from every EAS profile | AGENTS.md explicit decision/checklist |
| **TEV/LIE AI autopilot orchestration** | Building blocks exist; agentic pipeline (project-extract → financial model → sensitivity → chapter-synthesis → grounded review) not orchestrated | AGENTS.md open work: "deferred until GTM" |
| **DPR as DB enum column** | Currently lives only in JSONB `class_data`; no type safety or DB-level query support | AGENTS.md: "Promote `dpr` into DB enum when DPR ships" |
| **Multi-state portal coverage** | Only TG (Eswathu), KA (Kaveri), AP (Bhoomi) covered; other states are hard-coded `'other'` in `india_state` enum | `supabase/migrations/20260523120443`; `src/lib/portal-checks/register.ts` |
| **Sentry source-map upload** | Sentry wired but `withSentryConfig` wrap not applied; no source-map upload → stack traces point to minified code | AGENTS.md: "no source-map upload yet" |
| **Leaked-password protection** | Supabase dashboard toggle, not migratable; not yet enabled | AGENTS.md open work |
| **Hub marketing/landing funnel** | `src/app/(public)/` exists (landing, privacy, terms) but no evidence of conversion-optimized funnel, demo video, or bank-facing collateral as hub living demo | `AGENTS.md` route table shows `/` public landing; no deeper evidence |
| **L3 portal automation (browser worker)** | Design spec exists; `agent-worker.ts` stub exists; no live browser automation infrastructure | `docs/superpowers/specs/2026-06-11-tier3-agent-browser-worker-design.md`; `agent-worker.ts` shell |
| **PostHog events instrumentation** | Provider wired; no `posthog.capture('feature_used', ...)` events beyond automatic pageviews; no funnel/retention data | `src/components/posthog-provider.tsx`; no capture calls found |

---

## 5. Stack Summary (for reference docs)

From `package.json`, `README.md`, `AGENTS.md`:

| Layer | Technology |
|---|---|
| Frontend + SSR | Next.js 16 (App Router, Turbopack, React 19, Tailwind v4) |
| Hosting | Vercel, Functions pinned `bom1` (Mumbai) |
| DB / Auth / Storage | Supabase, `ap-south-1` (Mumbai) |
| AI | Google Gemini 2.5 Flash-Lite via Vercel AI Gateway (BYOK); Embeddings: `text-embedding-005` (768-dim) |
| Payments | Razorpay Standard Checkout (wallet); Subscriptions stubbed |
| SMS OTP | MSG91 via Supabase Send SMS Hook |
| Email | AWS SES Mumbai (custom SMTP in Supabase Auth) |
| Maps | Google Maps (default) + Mappls (opt-in) |
| Mobile | Expo SDK 56 / React Native 0.85, EAS builds |
| Error tracking | Sentry EU (env-gated, no DSN set yet) |
| Product analytics | PostHog EU (env-gated, no key set yet) |
| DNS | Cloudflare `gnanalytica.com` (grey cloud, DNS-only) |
| UI libs | Radix UI primitives, shadcn-style, Recharts, React-PDF, react-hook-form + zod, Zustand, sonner, TanStack Query (mobile) |

---

*Source files consulted: `README.md`, `AGENTS.md`, `docs/ai-retrieval-design.md`, `docs/architecture/ARCHITECTURE.md`, `package.json`, `supabase/migrations/` (all 74 migrations), `src/lib/` (engagement.ts, billing.ts, valuation-shared.ts, area.ts, tev/, lie/, pdf/, ai/, portal-checks/, site-visit/, chapters/), `src/app/(app)/` routes, `src/components/` (cases/, account/, billing/, map/), `evals/extraction/`, `mobile/` (src/, README.md, eas.json), `docs/superpowers/specs/` (all 11 spec files listed). No files were modified.*
