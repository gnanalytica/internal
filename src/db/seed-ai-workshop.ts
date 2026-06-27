import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq, max } from "drizzle-orm";

import { db, schema } from "./index";

/**
 * Seed the AI Workshop product roadmap (30-day AI program LMS) into the hub —
 * initiative, cycles, the phased Feature roadmap (completed Dec 2025 → Jun 2026 +
 * future) and tickets, grounded in the real ai-workshop codebase but stretched
 * over 7 months. People assumed present (db:seed-valytica). Idempotent.
 * Run: npm run db:seed-ai-workshop
 */

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
    title: "Foundation & Landing",
    desc: "Platform bootstrap: Supabase schema (profiles, cohorts, registrations, pods), magic-link + Google auth, RBAC via SECURITY DEFINER + RLS, and the public 30-day workshop landing page.",
    status: "shipped",
    start: "2025-12-01",
    target: "2025-12-20",
    owner: "harshith",
    tickets: [
      ["Init schema: profiles, cohorts, registrations, pods, assignments", "harshith"],
      ["Magic-link auth + sign-in modal on landing", "raunak"],
      ["auth_caps() SECURITY DEFINER + row-level policies", "harshith"],
      ["Auto-confirm registration on valid enrollment code", "raunak"],
      ["30-day workshop landing page + dark mode", "raunak"],
      ["Seed demo cohort (50 students, 5 pods, 6 faculty)", "harshith"],
      ["RBAC pgTAP-style spec (supabase/tests/rbac.sql)", "harshith"],
      ["Vercel + Supabase deployment wiring", "harshith"],
    ],
  },
  {
    title: "Dashboard Core & Enrollment",
    desc: "Student & admin dashboards, cohort day scheduling (30 working days), enrollment code flow, and the 5-tab student layout.",
    status: "shipped",
    start: "2025-12-20",
    target: "2026-01-22",
    owner: "raunak",
    tickets: [
      ["Student dashboard: 5-tab layout (Overview/Lessons/Capstone/Activity/Profile)", "raunak"],
      ["Admin monitoring dashboard + activity feed", "raunak"],
      ["Cohort day scheduling (auto-compute 30 working days)", "raunak"],
      ["Enrollment code modal + inline enroll card", "raunak"],
      ["auth_caps()/my_pod()/faculty_cohort_ids() RPCs", "harshith"],
      ["Admin schedule page (bulk multi-select, week quick-select)", "raunak"],
      ["Tailwind v4 + light/dark theme tokens", "raunak"],
      ["Session persistence + role resolution", "harshith"],
    ],
  },
  {
    title: "Curriculum & Content",
    desc: "The full 30-day course authored and delivered via MDX (next-mdx-remote) with frontmatter validation, phase tabs, TL;DR cards and embedded video.",
    status: "shipped",
    start: "2026-01-22",
    target: "2026-02-16",
    owner: "jay",
    tickets: [
      ["MDX loader + zod frontmatter validation", "raunak"],
      ["Author days 1–15 curriculum (hook, agenda, before/after class)", "jay"],
      ["Author days 16–30 curriculum + references", "jay"],
      ["TL;DR cards (50-word summaries) for all 30 days", "aparna"],
      ["lesson-day component with phase tabs (Intro/In-class/Assignment/Prep)", "raunak"],
      ["YouTube/Loom video embeds across days", "raunak"],
      ["Day rail navigation + sticky phase tabs", "raunak"],
      ["Backfill day titles + metadata seed", "harshith"],
    ],
  },
  {
    title: "Engagement & Community",
    desc: "Live polls with realtime aggregation, the Help Desk (stuck queue), kudos & peer recognition, announcements, and a daily digest email.",
    status: "shipped",
    start: "2026-02-16",
    target: "2026-03-10",
    owner: "raunak",
    tickets: [
      ["Live polls: admin console + student widget + realtime tally", "raunak"],
      ["Help Desk queue (open/helping/resolved/cancelled)", "raunak"],
      ["Kudos peer recognition + leaderboard", "raunak"],
      ["Announcements table + audience filtering + soft-delete", "harshith"],
      ["Daily digest email edge function (Resend)", "harshith"],
      ["Pair-matching algorithm for buddy system", "sanjana"],
      ["Auto-unlock daily cohort_days via cron trigger", "harshith"],
      ["Community Q&A board (tables + RLS)", "harshith"],
    ],
  },
  {
    title: "Faculty Pods & Mentorship",
    desc: "Pod-based cohort organization with faculty assignment, the faculty handbook, per-pod dashboards and student drill-down, backed by atomic pod-membership RPCs.",
    status: "shipped",
    start: "2026-03-10",
    target: "2026-03-31",
    owner: "aparna",
    tickets: [
      ["cohort_faculty / pod_faculty / pod_members tables + RLS", "harshith"],
      ["rpc_pod_faculty_event (atomic membership + audit log)", "harshith"],
      ["Faculty landing (Today + Handbook tabs)", "raunak"],
      ["Faculty handbook (platform setup, lab tools, onboarding)", "aparna"],
      ["Faculty 'My pod' view (members, progress, stuck items)", "raunak"],
      ["Faculty 'Whole cohort' view + student drill-down", "raunak"],
      ["Faculty notes per pod/student", "raunak"],
      ["Unify support/executive into single faculty role", "harshith"],
    ],
  },
  {
    title: "Grading & Submissions",
    desc: "Assignment submissions (text/links/files), AI-powered rubric grading via Gemini 2.5 Flash, a rubric template system, and a faculty review-only grading UI.",
    status: "shipped",
    start: "2026-03-31",
    target: "2026-04-25",
    owner: "sanjana",
    tickets: [
      ["Submission form: text + links + file uploads + word-count gate", "raunak"],
      ["Gemini 2.5 Flash grading (structured score/feedback/strengths/weaknesses)", "sanjana"],
      ["Rubric-aware grader prompt builder", "sanjana"],
      ["Rubric template system (criteria with anchors, weights)", "aparna"],
      ["Split faculty review-only vs admin write roles", "harshith"],
      ["Grading UI: compact picker, search, next-ungraded nav", "raunak"],
      ["Seed rubrics for weeks 1–2 assignments", "shraddha"],
      ["Submission status badges + score breakdown chart", "raunak"],
    ],
  },
  {
    title: "Analytics & Pulse",
    desc: "Cohort-wide analytics — the Pulse dashboard (submissions/quizzes/engagement/feedback), per-pod health metrics, per-day feedback rollups and KPI RPCs.",
    status: "shipped",
    start: "2026-04-15",
    target: "2026-05-08",
    owner: "raunak",
    tickets: [
      ["rpc_dashboard_kpis (active students, pods, open submissions)", "harshith"],
      ["Pulse landing: subject-first tabs + Recharts visualizations", "raunak"],
      ["Per-pod + per-student drill-down breakdowns", "raunak"],
      ["day_feedback table + per-day collection form", "harshith"],
      ["Cohort health panel (attendance, completion, quiz pass)", "raunak"],
      ["Window selector (last 7/14/30 days) + pagination", "raunak"],
      ["Program-wide aggregate analytics", "sanjana"],
      ["Admin-pod exclusion from metrics", "harshith"],
    ],
  },
  {
    title: "Capstone & Showcase",
    desc: "Team-based final project — team import, shared submissions, admin team grading, a public showcase gallery, and milestone-gated certificates.",
    status: "shipped",
    start: "2026-05-01",
    target: "2026-05-26",
    owner: "jay",
    tickets: [
      ["teams + team_members tables + CSV import (roll number resolution)", "harshith"],
      ["team_submissions (pitch/repo/demo/presentation) + deadlines", "raunak"],
      ["Public showcase gallery (cards, embedded demos, search)", "raunak"],
      ["Team grading UI (admin score + shared feedback)", "raunak"],
      ["Certificate eligibility (≥50% assignment completion)", "harshith"],
      ["CertificateCard (Canva overlay) + Download/Print (PDF)", "raunak"],
      ["Staff-only Teams board (members, rolls, ideas)", "raunak"],
      ["Certificate name styling + soft-launch gate", "jay"],
    ],
  },
  {
    title: "Refinement & Polish",
    desc: "Content finalization (days 13–30 reworks), roll-number capture, certificate launch, and broad UX polish ahead of the cohort.",
    status: "shipped",
    start: "2026-05-20",
    target: "2026-06-13",
    owner: "jay",
    tickets: [
      ["Roll-number capture on profile + self-serve RLS update", "harshith"],
      ["Content rework: Agentic AI, Groq/Firecrawl/n8n, Vibe Coding", "jay"],
      ["Vibe-coding portfolio assignment + 5-question quiz", "aparna"],
      ["Content: Data Viz, Chatbot+Orders, Gamma presentation days", "jay"],
      ["Certificate public launch + eligibility override (preview)", "raunak"],
      ["Days 25–30 finalization (Registration, Support, launch)", "jay"],
      ["Marketing assets + social promo for cohort launch", "shravani"],
      ["End-to-end QA pass across student/faculty/admin flows", "sairam"],
    ],
  },
  {
    title: "AI Tutoring & Help Chat",
    desc: "A conversational AI assistant — RAG over the handbook/FAQ corpus, an embedded sidebar chatbot, context-aware retrieval, and safety rails that avoid giving direct answers.",
    status: "building",
    start: "2026-06-05",
    target: "2026-06-30",
    owner: "sanjana",
    tickets: [
      ["Help-corpus indexing (handbook + FAQ sections)", "sanjana", "done"],
      ["Gemini help-chat model + Vercel AI SDK wiring", "sanjana", "done"],
      ["Embedded sidebar chatbot UI on authed pages", "raunak", "done"],
      ["Context-aware retrieval (cohort + day + topic injection)", "sanjana", "in_progress"],
      ["Chat history persistence per user per cohort", "harshith", "in_progress"],
      ["Safety rails: redirect to resources, no direct answers", "shraddha", "in_review"],
      ["Chat transcript export (markdown/PDF)", "raunak", "todo"],
      ["Help-chat eval harness (answer quality, leakage)", "shraddha", "todo"],
    ],
  },
  // ---- future ----
  {
    title: "Payments & Enrollment Billing",
    desc: "Wire real billing — Razorpay/Stripe checkout, paid enrollment tiers, promo-code redemption, invoices and refunds (promo codes exist; payment gateway is not yet integrated).",
    status: "planned",
    start: "2026-07-01",
    target: "2026-08-29",
    owner: "harshith",
    tickets: [
      ["Payment gateway integration (Razorpay/Stripe checkout)", "harshith"],
      ["Paid enrollment tiers + plan gating", "raunak"],
      ["Promo-code redemption wired to checkout", "raunak"],
      ["Invoices + receipts + refund flow", "harshith"],
      ["Billing legal review (terms, refunds, GST)", "manjusha"],
      ["Revenue dashboard (enrollments, MRR)", "sanjana"],
    ],
  },
  {
    title: "Mobile-First & PWA",
    desc: "Full mobile responsiveness, a drawer nav, mobile-optimized quiz/submission UX, and a PWA with offline access to cached days.",
    status: "planned",
    start: "2026-08-15",
    target: "2026-10-17",
    owner: "raunak",
    tickets: [
      ["Responsive audit + mobile drawer navigation", "raunak"],
      ["Mobile-optimized quiz UI (one question per screen)", "raunak"],
      ["Touch-friendly submission form + tap-to-upload", "raunak"],
      ["PWA manifest + service worker (offline cached days)", "harshith"],
      ["Tablet/portrait media-query polish", "raunak"],
      ["Playwright mobile-emulation test pass", "sairam"],
    ],
  },
  {
    title: "Gamification & Engagement",
    desc: "Badges, streaks, individual & team leaderboards, milestone bonuses and an end-of-cohort awards ceremony.",
    status: "idea",
    start: "2026-10-01",
    target: "2026-12-19",
    owner: "jay",
    tickets: [
      ["Badge system + trigger-based award logic", "harshith"],
      ["Streak tracking (attendance, quizzes, submissions)", "sanjana"],
      ["Individual + team leaderboards", "raunak"],
      ["Milestone bonus points + team challenges", "aparna"],
      ["Trophy case UI + celebration animations", "raunak"],
      ["End-of-cohort awards ceremony showcase", "jay"],
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
  if (!ws) return console.log("No gnanalytica workspace.");

  const [project] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(and(eq(schema.projects.workspaceId, ws.id), eq(schema.projects.name, "AI Workshop")))
    .limit(1);
  if (!project) return console.log("No 'AI Workshop' project found.");

  const users = await db.select({ id: schema.users.id, email: schema.users.email }).from(schema.users);
  const userByEmail = new Map(users.map((u) => [u.email, u.id]));
  const uid = (k: string) => userByEmail.get(KEY[k]) ?? null;
  const creatorId = uid("sandeep");


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
  console.log(`AI Workshop roadmap seeded: ${featureCount} phases, ${issueCount} tickets.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
