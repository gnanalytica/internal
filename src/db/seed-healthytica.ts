import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq, max } from "drizzle-orm";

import { db, schema } from "./index";

/**
 * Seed the Healthytica product roadmap into the Gnanalytica hub: a Healthytica
 * initiative, monthly cycles, the phased Feature roadmap (completed Dec 2025 →
 * Jun 2026 + future), and tickets under each phase — grounded in the real
 * Healthytica codebase but stretched over 7 months. People are assumed already
 * present (added by db:seed-valytica). Idempotent. Run: npm run db:seed-healthytica
 */

// short key (used in tickets) -> email; users already exist in the hub.
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
    title: "Foundation & Clinical TS Engine",
    desc: "Zero-dependency TypeScript engine: biomarker registry with unit conversions, normalization, longitudinal trend detection, glycemic & cardiovascular rules, anomaly detection and heuristic risk scoring.",
    status: "shipped",
    start: "2025-12-01",
    target: "2025-12-22",
    owner: "sandeep",
    tickets: [
      ["Biomarker registry with unit conversions (mg/dL, mmol/L, %, NGSP)", "sanjana"],
      ["Normalization engine: unit→canonical + mislabel detection", "sanjana"],
      ["Longitudinal trend detection (rising/falling/stable/volatile)", "sanjana"],
      ["Glycemic rules (HbA1c bands, glucose, insulin-resistance flags)", "shraddha"],
      ["Cardiovascular rules (LDL/HDL patterns, hs-CRP inflammation)", "shraddha"],
      ["Anomaly detection (outliers, lab transcription errors)", "sanjana"],
      ["Heuristic risk scoring (0..1 per domain, sigmoid band mapping)", "sanjana"],
      ["Vitest engine test harness (golden clinical cases)", "raunak"],
      ["pnpm workspace (packages/engine, apps/web, packages/shared)", "harshith"],
    ],
  },
  {
    title: "Web App & AI Ingestion",
    desc: "Next.js 15 web app with Supabase SSR auth, consent gate, LLM-powered PDF/image extraction (Claude via Vercel AI SDK), manual-entry fallback, and the upload → review → save flow.",
    status: "shipped",
    start: "2025-12-22",
    target: "2026-01-23",
    owner: "raunak",
    tickets: [
      ["Supabase schema (profiles, reports, readings, consents) + RLS", "harshith"],
      ["Supabase SSR auth + consent gate (first-run blocking)", "raunak"],
      ["Claude PDF/image extraction via Vercel AI SDK", "sanjana"],
      ["Upload flow: PDF → Storage → extract → review table → save", "raunak"],
      ["Manual-entry fallback for unparsed reports", "raunak"],
      ["Server Actions for extract/persist ingestion cores", "raunak"],
      ["Dashboard: run engine analyse() server-side + render flags", "raunak"],
      ["Dark command-center UI aesthetic", "raunak"],
    ],
  },
  {
    title: "Mobile v1 (Expo, on-device)",
    desc: "Expo Router mobile app with Google OAuth (PKCE), camera capture, the extraction/review flow, and on-device engine analysis (no server compute) + EAS Android builds.",
    status: "shipped",
    start: "2026-01-23",
    target: "2026-02-17",
    owner: "raunak",
    tickets: [
      ["Scaffold Expo Router app + auth context + SecureStore session", "raunak"],
      ["Google OAuth PKCE flow for native + deep-link callback", "raunak"],
      ["Camera capture (expo-camera/image-picker) + upload", "raunak"],
      ["Mobile extraction & review flow (Bearer /api/extract)", "raunak"],
      ["On-device dashboard: engine analyse() runs natively", "sanjana"],
      ["Bearer-auth API handlers (/api/extract, /api/reports)", "harshith"],
      ["Metro config: stub node:crypto so engine bundles", "harshith"],
      ["EAS build profiles + GitHub Actions Android APK/AAB", "harshith"],
    ],
  },
  {
    title: "Legal, Auth UX & Biomarker Expansion",
    desc: "Terms of Service & Privacy Policy, Google sign-in on web as the primary action, and an expanded biomarker registry with more analytes and unit tables.",
    status: "shipped",
    start: "2026-02-17",
    target: "2026-03-10",
    owner: "jay",
    tickets: [
      ["Draft & publish Terms of Service + Privacy Policy pages", "manjusha"],
      ["Continue-with-Google on web login/signup (primary CTA)", "raunak"],
      ["Expand registry: B12, folate, magnesium, phosphorus", "shraddha"],
      ["Widen HbA1c/LDL/HDL unit tables (IFCC mmol/mol etc.)", "sanjana"],
      ["Improve extraction parser for more lab layouts", "sanjana"],
      ["Consent versioning tied to policy version", "manjusha"],
      ["Onboarding copy + disclaimers across web/mobile", "jay"],
      ["Production build scripts + env wiring", "harshith"],
    ],
  },
  {
    title: "Renal Analytics & Dashboard Charts",
    desc: "Renal domain (eGFR via MDRD/CKD-EPI, CKD staging, renal flags), HbA1c/LDL/HDL trend charts (Recharts), a light/dark theme toggle, and unit-mislabel flagging.",
    status: "shipped",
    start: "2026-03-10",
    target: "2026-04-01",
    owner: "shraddha",
    tickets: [
      ["eGFR calculation (MDRD + CKD-EPI) from creatinine/age/sex", "sanjana"],
      ["CKD staging (1–5) + renal pattern detection (BUN/creatinine)", "shraddha"],
      ["Renal risk flags + recommendations (refer if eGFR < 60)", "shraddha"],
      ["HbA1c/LDL/HDL trend charts with reference bands (Recharts)", "raunak"],
      ["Unit/analyte mislabel detection + explanatory hints", "sanjana"],
      ["Light/dark theme toggle + persistence (web + mobile)", "raunak"],
      ["Brand refresh: leaf + rising-arrow logo, blue→green palette", "shravani"],
      ["Surface mislabel warnings on review + dashboard", "raunak"],
    ],
  },
  {
    title: "Wellness Plans & Correlation Network",
    desc: "Deterministic diet & workout plan generation tailored to risk domains and fitness level, plus a biomarker correlation network (Pearson r, force-directed D3 graph).",
    status: "shipped",
    start: "2026-04-01",
    target: "2026-04-26",
    owner: "sanjana",
    tickets: [
      ["generateWellnessPlan(): weekly diet plan by diet preference", "sanjana"],
      ["Glycemic/cardio/renal-friendly meal suggestions", "shraddha"],
      ["Workout plan generator (strength/cardio/flexibility by domain)", "sanjana"],
      ["Exercise-level scaling (sedentary → active baseline)", "sanjana"],
      ["Pearson correlation over biomarker time-series (min n=3)", "sanjana"],
      ["Edge filtering (r ≥ 0.5) to cut statistical noise", "sanjana"],
      ["Force-directed correlation graph (d3-force) on dashboard", "raunak"],
      ["Plan personalization review (clinical sanity)", "shraddha"],
    ],
  },
  {
    title: "Reports & Export",
    desc: "Shareable health reports — engine buildHtml() → HTML/PDF export with trends, flags, recommendations and wellness plan, plus the dashboard export endpoint.",
    status: "shipped",
    start: "2026-04-20",
    target: "2026-05-14",
    owner: "raunak",
    tickets: [
      ["engine buildHtml(): full report (trends, flags, plan)", "sanjana"],
      ["/api/dashboard/export → PDF download (Bearer auth)", "harshith"],
      ["Report layout + reference-range visuals", "raunak"],
      ["Include diet/workout plan in exported report", "raunak"],
      ["Shareable report link with disclaimer + consent check", "raunak"],
      ["Mobile export via expo-sharing / email", "raunak"],
      ["Report content legal review (non-diagnostic framing)", "manjusha"],
      ["Export performance: lazy data load + caching", "harshith"],
    ],
  },
  {
    title: "Privacy, Consent & Compliance",
    desc: "Privacy-first hardening — consent audit trail, PII pseudonymization, mandatory disclaimers on every output, and data-handling controls.",
    status: "shipped",
    start: "2026-05-05",
    target: "2026-05-28",
    owner: "manjusha",
    tickets: [
      ["Consent audit trail (grant/revoke, versioned)", "manjusha"],
      ["PII pseudonymization module (pseudonymize.ts)", "pranav"],
      ["Full disclaimer attached to every engine output", "manjusha"],
      ["Account & data deletion (cascade reports/readings)", "harshith"],
      ["Encryption-at-rest + TLS posture review", "pranav"],
      ["RLS coverage audit (per-user isolation on all tables)", "pranav"],
      ["DPDP data-handling policy + India residency note", "manjusha"],
      ["Consent gate enforcement on web + mobile", "raunak"],
    ],
  },
  {
    title: "Observability & Production Hardening",
    desc: "Production readiness — error logging, client analytics, API rate limiting, request signing for mobile, and a monitoring view of extraction success/error rates.",
    status: "shipped",
    start: "2026-05-20",
    target: "2026-06-13",
    owner: "harshith",
    tickets: [
      ["Server-side error logging (Sentry, env-gated)", "harshith"],
      ["Client analytics (feature adoption, funnel)", "raunak"],
      ["Rate limiting on /api/extract and /api/reports", "harshith"],
      ["HMAC request signing for mobile API calls", "pranav"],
      ["Extraction success-rate + latency monitoring", "harshith"],
      ["Dependency update + security scanning automation", "harshith"],
      ["Incident runbook (extraction failures, auth issues)", "sairam"],
      ["Load test ingestion path + tune cold starts", "harshith"],
    ],
  },
  {
    title: "Admin & Data Tools",
    desc: "Internal admin dashboard for user management, data exports and support, plus audit logging for sensitive operations and feature flags.",
    status: "building",
    start: "2026-06-05",
    target: "2026-06-30",
    owner: "harshith",
    tickets: [
      ["Admin dashboard: user list, profile view, support actions", "raunak", "done"],
      ["Audit logging for uploads/consent/deletion", "harshith", "done"],
      ["Feature flags (recommendation variants, UI experiments)", "harshith", "done"],
      ["Data export pipeline (per-user, regulatory)", "harshith", "in_progress"],
      ["Support access logs with scoped, expiring grants", "pranav", "in_progress"],
      ["Extraction-quality dashboard (per-field confidence)", "sanjana", "in_review"],
      ["Bulk re-analysis tool after engine updates", "sanjana", "todo"],
      ["Admin RBAC + protected routes", "harshith", "todo"],
    ],
  },
  // ---- future ----
  {
    title: "Predictive ML & Risk Stratification",
    desc: "Move beyond heuristic scoring to calibrated predictive models with a labeled outcomes dataset, validation harness (AUROC/Brier), and opt-in advanced risk estimates.",
    status: "planned",
    start: "2026-07-01",
    target: "2026-08-29",
    owner: "sanjana",
    tickets: [
      ["Collect de-identified longitudinal cohort with outcomes", "shraddha"],
      ["Logistic-regression baseline (HbA1c trajectory → diabetes risk)", "sanjana"],
      ["XGBoost multi-domain risk ensemble", "sanjana"],
      ["AUROC / Brier / reliability validation harness", "sanjana"],
      ["Calibrated opt-in 'advanced risk estimate' in engine", "shraddha"],
      ["Model versioning + heuristic fallback + drift monitoring", "harshith"],
    ],
  },
  {
    title: "Multi-Analyte Expansion & India Adaptation",
    desc: "Extend domains (blood pressure, thyroid, liver, iron) and adapt to India — ICMR reference ranges, localized diet, and Hindi/regional language support.",
    status: "planned",
    start: "2026-08-15",
    target: "2026-10-17",
    owner: "shraddha",
    tickets: [
      ["Blood pressure domain + hypertension staging", "shraddha"],
      ["Thyroid panel (TSH/T3/T4/anti-TPO) flags", "shraddha"],
      ["Liver function domain (ALT/AST/GGT/bilirubin)", "shraddha"],
      ["Iron metabolism (ferritin/TIBC) for veg populations", "sanjana"],
      ["India-specific reference ranges (ICMR) + lab calibration", "sanjana"],
      ["Localized diet (Indian staples) + Hindi UI/recommendations", "shravani"],
    ],
  },
  {
    title: "Clinician Dashboard & Institutional",
    desc: "Shift from pure self-service to clinician-integrated workflows — provider dashboard, patient-clinician linking, clinical notes, follow-up scheduling and clinic admin.",
    status: "idea",
    start: "2026-10-01",
    target: "2026-12-19",
    owner: "jay",
    tickets: [
      ["Clinician dashboard: patient list + profile review", "raunak"],
      ["Clinician sign-up + license verification", "manjusha"],
      ["Patient ↔ clinician linking (invite + access)", "raunak"],
      ["Clinical notes + follow-up reminders (recheck in N months)", "raunak"],
      ["Clinic admin (team, usage reports, billing)", "harshith"],
      ["Institutional onboarding + compliance (BAA / India health act)", "manjusha"],
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
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(and(eq(schema.projects.workspaceId, ws.id), eq(schema.projects.name, "Healthytica")))
    .limit(1);
  if (!project) {
    console.log("No Healthytica project found.");
    return;
  }
  // Resolve user ids (people already added by db:seed-valytica).
  const emails = [...new Set(Object.values(KEY))];
  const users = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users);
  const userByEmail = new Map(users.map((u) => [u.email, u.id]));
  const uid = (k: string) => userByEmail.get(KEY[k]) ?? null;
  const missing = emails.filter((e) => !userByEmail.has(e));
  if (missing.length) console.log(`Note: missing users (run db:seed-valytica first): ${missing.join(", ")}`);
  const creatorId = uid("sandeep");

  // Healthytica initiative
  let [initiative] = await db
    .select({ id: schema.initiatives.id })
    .from(schema.initiatives)
    .where(and(eq(schema.initiatives.workspaceId, ws.id), eq(schema.initiatives.name, "Healthytica")))
    .limit(1);
  if (!initiative) {
    [initiative] = await db
      .insert(schema.initiatives)
      .values({ workspaceId: ws.id, name: "Healthytica", color: "#10b981" })
      .returning({ id: schema.initiatives.id });
  }
  await db.update(schema.projects).set({ initiativeId: initiative.id }).where(eq(schema.projects.id, project.id));

  // Cycles: monthly Dec 2025 → Dec 2026 (reuse existing by name).
  const cycleByMonth: Record<string, string> = {};
  const existingCycles = await db
    .select({ id: schema.cycles.id, name: schema.cycles.name, number: schema.cycles.number })
    .from(schema.cycles)
    .where(eq(schema.cycles.workspaceId, ws.id));
  let cycleNum = existingCycles.reduce((m, c) => Math.max(m, c.number), 0);
  for (let i = 0; i < 13; i++) {
    const start = new Date(Date.UTC(2025, 11 + i, 1));
    const end = new Date(Date.UTC(2025, 11 + i + 1, 0));
    const name = start.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
    let c = existingCycles.find((x) => x.name === name);
    if (!c) {
      const [created] = await db
        .insert(schema.cycles)
        .values({ workspaceId: ws.id, projectId: project.id, name, number: ++cycleNum, startDate: start, endDate: end })
        .returning({ id: schema.cycles.id, name: schema.cycles.name, number: schema.cycles.number });
      c = created;
    }
    cycleByMonth[monthKey(start)] = c.id;
  }

  // Features + issues
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
        ownerId: uid(ph.owner),
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
        (ph.status === "shipped" ? "done" : ph.status === "building" ? "todo" : ti === 0 ? "todo" : "backlog");
      await db.insert(schema.issues).values({
        workspaceId: ws.id,
        projectId: project.id,
        featureId: feature.id,
        cycleId: cycleByMonth[monthKey(createdAt)] ?? null,
        number: ++issueNum,
        title,
        status,
        priority: PRIORITY_CYCLE[(pi + ti) % PRIORITY_CYCLE.length],
        assigneeId: uid(who),
        creatorId,
        sortKey: `a${String(ti).padStart(3, "0")}`,
        createdAt,
        updatedAt: status === "done" ? target : createdAt,
      });
      issueCount++;
    }
  }

  console.log(`Healthytica roadmap seeded: ${featureCount} phases, ${issueCount} tickets.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
