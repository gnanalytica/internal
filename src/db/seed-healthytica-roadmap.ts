import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq, isNull } from "drizzle-orm";

import { db, schema } from "./index";

/**
 * Seed the Healthytica project roadmap into the hub, grounded in the real
 * /Users/sandeeppvn/code/Healthytica repo (pnpm monorepo: Next.js 15 web +
 * Expo mobile + a pure-TypeScript clinical engine over Supabase) for
 * longitudinal blood-biomarker health intelligence:
 *   - Milestones (release phases) with target dates
 *   - The existing 13 features assigned to milestones + enriched specs
 *     (each spec = that feature's requirements checklist)
 *   - A "Roadmap & Requirements" Docs tree: one requirements page per milestone
 *   - Reference Docs mirroring the real repo (engine, AI ingestion, privacy, …)
 *
 * Existing feature dates and the linked issues are left untouched.
 * Idempotent (upserts by name/title). Run: npm run db:seed-healthytica-roadmap
 *
 * NOTE: non-diagnostic decision-support. No fabricated clinical claims,
 * reference ranges, or business metrics — everything below is grounded in code.
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
  { key: "m0", name: "v1.0 · Shipped", targetDate: "2026-06-04", desc: "Shipped — the pure-TS clinical engine, web upload + AI ingestion, on-device Expo mobile v1, legal/auth UX & biomarker expansion, renal analytics & dashboard charts, wellness plans & correlation network, reports & export, privacy/consent/compliance, and production hardening." },
  { key: "m1", name: "Admin & Hardening", targetDate: "2026-06-30", desc: "Internal admin and data tooling: seed/import, extraction validation, and observability hooks." },
  { key: "m2", name: "v2.0 · Predictive & Expansion", targetDate: "2026-10-17", desc: "Predictive ML & risk stratification, plus multi-analyte expansion and India (ICMR) adaptation." },
  { key: "m3", name: "vNext · Clinician & Institutional", targetDate: "2026-12-19", desc: "Consent-gated clinician read-only views and institutional / cohort reporting." },
];

// ---- features → milestone + requirements (grounded in the real repo) ----
const FEATURES: { title: string; milestone: string; intro: string; reqs: string[] }[] = [
  {
    title: "Foundation & Clinical TS Engine",
    milestone: "m0",
    intro: "The clinical core: a dependency-free TypeScript engine that turns biomarker readings into explainable findings, embeddable on web and on-device.",
    reqs: [
      "Pure-TypeScript clinical engine (packages/engine, zero runtime deps) embeddable in the browser, the server, and the mobile app; 9 Vitest suites.",
      "Core domain models (models.ts): PatientProfile, Report, BiomarkerReading, RiskFlag (code / severity / evidence), AnalysisResult.",
      "Biomarker registry (biomarkers.ts): 34 analytes with canonical units, reference ranges, thresholds, and unit-conversion tables.",
      "Unit normalization (normalize.ts): mmol/L ↔ mg/dL plus 50+ unit strings; flags unrecognized units and likely misattribution.",
    ],
  },
  {
    title: "Web App & AI Ingestion",
    milestone: "m0",
    intro: "How reports get into the system: drag-drop upload, AI extraction with a human review step, and a manual fallback that always works.",
    reqs: [
      "Upload flow (apps/web .../upload): PDF/image to Supabase Storage → /api/extract (Gemini 2.5 Flash via Vercel AI Gateway) → Zod-validated ExtractResult → review table → save to readings.",
      "Fallback to manual entry when extraction is incomplete or the API is down; every reading is editable before commit.",
      "Consent gate (/consent) before the first analysis, audit-logged to the consents table.",
      "Optional profile metadata (/profile): age, sex, diet, exercise, smoker/alcohol, conditions, family history — used to tailor recommendations.",
    ],
  },
  {
    title: "Mobile v1 (Expo, on-device)",
    milestone: "m0",
    intro: "An Expo app that captures reports and runs the same clinical engine locally on the device.",
    reqs: [
      "Expo SDK 56 / Expo Router app; email-password, OTP, and Google OAuth (PKCE via deep link healthytica://auth-callback).",
      "Capture (capture.tsx): camera / image picker → Supabase Storage → web /api/extract with a Bearer token → review & confirm.",
      "On-device dashboard runs @healthytica/engine analyse() locally; renders risk bands, HbA1c/LDL/HDL trends, and the correlation network.",
      "Secure token storage via expo-secure-store; EAS dev / preview / prod build profiles.",
      "Known v1 limits: no Sign in with Apple, image-only capture (no PDF pick), no offline sync, export/delete web-only.",
    ],
  },
  {
    title: "Legal, Auth UX & Biomarker Expansion",
    milestone: "m0",
    intro: "The trust surface: disclaimers and consent text wired everywhere, plus a widening set of recognized analytes.",
    reqs: [
      "Terms & Privacy pages (web + mobile): non-diagnostic disclaimer, AI limitations, data-handling principles, and consent text.",
      "Consent audit (privacy.ts): CONSENT_TEXT + AI_LIMITATIONS attached to every analysis output.",
      "Auth middleware (apps/web/src/lib/supabase/middleware.ts) verifies the Supabase session and redirects unauthenticated users.",
      "Biomarker registry expansion: blood pressure, vitamin D, ferritin, TSH/thyroid, liver enzymes, and CBC counts with conversion factors and ranges.",
    ],
  },
  {
    title: "Renal Analytics & Dashboard Charts",
    milestone: "m0",
    intro: "Kidney-function analysis plus the trend visualizations that make trajectories legible.",
    reqs: [
      "Renal module (renal.ts): eGFR via the CKD-EPI 2021 (race-free) equation, KDIGO G1–G5 staging, and flags for creatinine / urea / potassium / sodium.",
      "Dashboard trend charts (TrendCharts.tsx, Recharts): HbA1c, LDL, and HDL over time with direction (improving / stable / worsening) and severity bands.",
      "Risk bands (RiskBands.tsx): a per-domain meter (glycemic, cardiovascular, renal) with color-coded severity.",
    ],
  },
  {
    title: "Wellness Plans & Correlation Network",
    milestone: "m0",
    intro: "Actionable, deterministic guidance plus a graph that reveals how a person's biomarkers move together.",
    reqs: [
      "Diet & workout plan generator (plan.ts): deterministic, rules-based weekly plan tailored by domain risk, diet preference, and activity level.",
      "Correlation network (correlation.ts): Pearson correlation between biomarker pairs on shared dates (≥3 overlapping timepoints, |r| ≥ 0.5) → nodes + edges.",
      "Interactive D3-force graph on the dashboard (CorrelationNetwork.tsx).",
    ],
  },
  {
    title: "Reports & Export",
    milestone: "m0",
    intro: "A shareable, printable summary of findings — with the non-diagnostic framing baked in.",
    reqs: [
      "HTML report generation (reports.ts buildHtml): a styled, printable page with findings, risk flags + evidence, recommendations, and a non-diagnostic footer.",
      "Print / export button (PrintButton.tsx) serves text/html for browser print or PDF export.",
      "Report library (web): uploaded reports listed with lab name, date, and reading count.",
    ],
  },
  {
    title: "Privacy, Consent & Compliance",
    milestone: "m0",
    intro: "Data isolation by construction: per-user row-level security, audited consent, and PII redaction.",
    reqs: [
      "Supabase row-level security (0002_rls.sql): every table scoped via auth.uid(); the service-role key is server-only.",
      "Consent versioning (consents table): granted, grantedOn, version, with an audit trail of decisions.",
      "PII redaction (privacy.ts, pseudonymize.ts): best-effort removal of emails, phone numbers, long ID runs, and name lines.",
      "Private reports Storage bucket (0003_storage.sql), files at <user_id>/<filename>; one-action data export / delete (DeleteDataForm.tsx).",
    ],
  },
  {
    title: "Observability & Production Hardening",
    milestone: "m0",
    intro: "Making the pipeline dependable: typed contracts, fail-soft behavior, and a tested engine.",
    reqs: [
      "Typed API contracts via Zod (packages/shared/src/contracts.ts): extract request/result and confirm reading/report schemas.",
      "Graceful degradation: LLM failure → manual entry; unrecognized units excluded from trends; a bad rule is logged and analysis continues.",
      "9 Vitest suites in packages/engine covering glycemic / cardiovascular / longitudinal / renal rules plus anomaly, risk-scoring, and mappers.",
    ],
  },
  {
    title: "Admin & Data Tools",
    milestone: "m1",
    intro: "Internal tooling to seed, import, and validate data and to watch the extraction pipeline.",
    reqs: [
      "Seed data (supabase/seed.sql) for sample profiles and reports.",
      "Planned CLI: bulk-import de-identified test reports, validate extraction, and benchmark parser accuracy.",
      "Planned observability hooks: extraction success rate, common parse errors, and rule-firing frequency.",
    ],
  },
  {
    title: "Predictive ML & Risk Stratification",
    milestone: "m2",
    intro: "Heuristic, transparent risk scoring that ranks insights — explicitly a non-validated pilot, not a clinical decision.",
    reqs: [
      "Heuristic risk scoring (ml/risk-scoring.ts): domain logistic functions (glycemic / cardiovascular / renal) → a 0–1 score and bands, with transparent contributing factors.",
      "Anomaly detection (ml/anomaly.ts): z-score / isolation-style outlier flagging to surface likely lab or transcription errors for review.",
      "Explicit caveat: non-validated pilot, used for ranking insights only; calibration against validation data is a prerequisite before any clinical positioning.",
    ],
  },
  {
    title: "Multi-Analyte Expansion & India Adaptation",
    milestone: "m2",
    intro: "Widen analyte coverage and tune thresholds and parsing for the Indian context.",
    reqs: [
      "Extended biomarker registry (docs/biomarker-reference.csv): 34 analytes plus placeholders, each with unit tables and thresholds.",
      "India context: lipid cut-offs aligned to ICMR (not yet enforced); glucose / HbA1c following ADA + ICMR; family-history fields for diabetes / CVD.",
      "Unit handling: both SI and Imperial with auto-conversion; common Indian lab report layouts recognized in the extraction schema.",
    ],
  },
  {
    title: "Clinician Dashboard & Institutional",
    milestone: "m3",
    intro: "Open the longitudinal record to clinicians and institutions, under consent and role-based access.",
    reqs: [
      "Deferred past v1. Planned: a clinician read-only view of a patient's longitudinal record (with consent).",
      "Planned: institutional reporting — cohort risk summaries, consent-audit compliance, and EMR export.",
      "Planned: role-based access separating clinician, patient, and admin.",
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
      p("System map for Healthytica: a pnpm monorepo with a Next.js 15 web app, an Expo mobile app, and a pure-TS clinical engine, over Supabase (Postgres, Auth, Storage)."),
      h(2, "Design principles"),
      bullets([
        "Explainability: every flag carries a code, severity, and evidence string.",
        "Normalization-first: units are canonicalized before any rule runs.",
        "Fail-soft: extraction failure → manual entry; a bad rule is logged, analysis continues.",
        "Non-diagnostic by construction: disclaimers and consent are centralized and attached to output.",
        "Privacy by isolation: RLS per user; private Storage bucket; service-role key server-only.",
      ]),
      p("Source: docs/architecture.md."),
    ],
  },
  {
    title: "Clinical Validation & Safety Plan",
    icon: "🩺",
    nodes: [
      h(1, "Clinical Validation & Safety Plan"),
      p("Where thresholds come from and how trust is earned, stage by stage."),
      bullets([
        "Sources of truth for thresholds: ADA, NCEP ATP III, AHA/CDC (and ICMR for India adaptation).",
        "Validation stages: unit tests (done), synthetic trajectories (in progress), parser benchmarking (planned), clinician review (pre-pilot), risk-score calibration (deferred).",
        "Safety guardrails: non-diagnostic disclaimers, audited consent, and anomaly flagging for likely lab errors.",
      ]),
      p("Source: docs/clinical-validation.md and the M1 biomarker deep-dives."),
    ],
  },
  {
    title: "Biomarker Registry & Unit Conversions",
    icon: "🧬",
    nodes: [
      h(1, "Biomarker Registry & Unit Conversions"),
      bullets([
        "Canonical units, reference ranges (with sex/age breaks), and per-domain thresholds for 34 analytes.",
        "Unit-conversion tables (factor + offset), e.g. mmol/L ↔ mg/dL.",
        "Mislabel detection: a unit valid for one analyte but not the labelled one is flagged (e.g. g/dL is Hemoglobin's, not HbA1c's).",
      ]),
      p("Source: packages/engine/src/biomarkers.ts and docs/biomarker-reference.csv."),
    ],
  },
  {
    title: "AI Extraction & LLM Prompting",
    icon: "🤖",
    nodes: [
      h(1, "AI Extraction & LLM Prompting"),
      bullets([
        "Gemini 2.5 Flash via the Vercel AI Gateway extracts lab, date, and readings (rawLabel, analyteGuess, value, unit, numericValue).",
        "Zod-validated ExtractResult; PII redaction runs before storage; every reading is editable before commit.",
        "Fallback to manual entry on failure; unit-mismatch hints surface likely extraction errors.",
      ]),
      p("Source: apps/web/src/lib/ingestion/extract-core.ts and packages/shared/src/contracts.ts."),
    ],
  },
  {
    title: "Privacy, Consent & Data Handling",
    icon: "🔐",
    nodes: [
      h(1, "Privacy, Consent & Data Handling"),
      bullets([
        "Row-level security scopes every table to the signed-in user (auth.uid()).",
        "Consent text + AI limitations attached to outputs; consent decisions versioned and audited.",
        "PII redaction for emails, phones, long ID runs, and name lines.",
        "Private reports Storage bucket; one-action export / delete for the user's data.",
      ]),
      p("Source: packages/engine/src/privacy.ts and supabase/migrations/0002_rls.sql, 0003_storage.sql."),
    ],
  },
  {
    title: "Mobile Architecture & Deep-Linking",
    icon: "📱",
    nodes: [
      h(1, "Mobile Architecture & Deep-Linking"),
      bullets([
        "Expo Router structure; Google OAuth via PKCE + deep link (healthytica://auth-callback).",
        "On-device analysis: the engine's analyse() runs locally over the user's reports.",
        "Supabase session persisted in expo-secure-store; API contracts shared with the web backend.",
        "Built and distributed via EAS (development / preview / production profiles).",
      ]),
      p("Source: apps/mobile/README.md, apps/mobile/lib/google-auth.ts."),
    ],
  },
  {
    title: "Rules & Risk Flags",
    icon: "⚖️",
    nodes: [
      h(1, "Rules & Risk Flags"),
      bullets([
        "Per-domain rules (glycemic, cardio, longitudinal, renal) with explicit thresholds and evidence strings.",
        "Trend logic: a rising marker even within the normal range can raise a low-severity early-warning.",
        "Combined rules: e.g. CVD_METABOLIC_RISK fires on rising HbA1c together with falling HDL.",
        "Every rule is unit-tested, enabling clinician review and per-protocol tuning.",
      ]),
      p("Source: packages/engine/src/rules/{glycemic,cardio,longitudinal,renal}.ts."),
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
    .where(and(eq(schema.projects.workspaceId, ws.id), eq(schema.projects.name, "Healthytica")))
    .limit(1);
  if (!project) return console.log("No Healthytica project.");

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
      p("Release phases for Healthytica and the requirements behind each. Per-feature requirements also live on each feature's spec in the Product roadmap."),
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

  console.log("Done — Healthytica roadmap seeded.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
