import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq, isNull } from "drizzle-orm";

import { db, schema } from "./index";

/**
 * Seed the AI Workshop project roadmap into the hub, grounded in the real
 * /Users/sandeeppvn/code/ai-workshop repo (Next.js 15 + Supabase SaaS LMS for a
 * 30-day AI workshop):
 *   - Milestones (release phases) with target dates
 *   - The existing 13 features assigned to milestones + enriched specs
 *     (each spec = that feature's requirements checklist)
 *   - A "Roadmap & Requirements" Docs tree: one requirements page per milestone
 *   - Reference Docs mirroring the real repo (RBAC, schema, curriculum, …)
 *
 * Existing feature dates and the linked issues are left untouched.
 * Idempotent (upserts by name/title). Run: npm run db:seed-ai-workshop-roadmap
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
  { key: "m0", name: "v1.0 · Shipped", targetDate: "2026-06-04", desc: "Shipped — magic-link auth & RBAC foundation, dashboard & enrollment, the 30-day MDX curriculum, community & kudos, faculty pods, grading & submissions, analytics & digests, team capstone & showcase, and certificates." },
  { key: "m1", name: "AI Tutoring & Polish", targetDate: "2026-06-30", desc: "Wire the AI SDK groundwork into the help desk as a curriculum- and rubric-aware first-line tutor." },
  { key: "m2", name: "v2.0 · Payments & Mobile", targetDate: "2026-10-17", desc: "Payment-driven enrollment beyond manual confirmation, and an installable, offline-capable PWA." },
  { key: "m3", name: "vNext · Gamification", targetDate: "2026-12-19", desc: "An XP / badges / streaks layer on top of the existing activity-score leaderboard." },
];

// ---- features → milestone + requirements (grounded in the real repo) ----
const FEATURES: { title: string; milestone: string; intro: string; reqs: string[] }[] = [
  {
    title: "Foundation & Landing",
    milestone: "m0",
    intro: "The auth and access base every other surface sits on: identity, the app shell, and role-aware routing.",
    reqs: [
      "Magic-link sign-in (/sign-in) via @supabase/ssr middleware — email-only, no password; session cookie refresh in middleware.",
      "Public landing (pre-auth) plus a gated AppShell (Sidebar, Topbar, cmd-K NavSearch) for all authenticated routes.",
      "RLS on every table; access resolved by the auth_caps(cohort) SECURITY DEFINER function (20+ capabilities across 6 personas in lib/rbac/capabilities.ts).",
      "Role-based menu filtering: admin → /admin/*, faculty → /faculty/*, student → /learn, /pods (menus in lib/rbac/menus.ts).",
      "/denied page plus middleware auth checks for capability violations.",
    ],
  },
  {
    title: "Dashboard Core & Enrollment",
    milestone: "m0",
    intro: "The student's home and the admin's roster: where a cohort member lands and how they get there.",
    reqs: [
      "Dashboard (/dashboard) showing enrolled cohort, active day, pod assignment, and KPI cards (attendance, submissions, grades).",
      "Enrollment workflow capturing college email and setting registration status (pending → confirmed → waitlist → cancelled).",
      "Roll-number capture on first login (/start/roll-number) as the canonical student identifier.",
      "Admin roster management (/admin/roster) with status filters; promo-code source tracked per registration.",
    ],
  },
  {
    title: "Curriculum & Content",
    milestone: "m0",
    intro: "The 30-day spine of the workshop: authored content, per-day scheduling, and gated delivery.",
    reqs: [
      "30-day curriculum as MDX (day-01.mdx → day-30.mdx) with Zod-validated frontmatter (date, weekday, topic, faculty, tldr, prompt_of_the_day, online_tools, lab, objectives, tags).",
      "Per-day metadata table (cohort_days): unlock/lock, live_session_at, meet_link, capstone_kind (none / spec_review / mid_review / demo_day).",
      "Server-side MDX rendering via next-mdx-remote/rsc + remark-gfm; day content gated by the content.read capability.",
      "Multi-model day prompts referencing ChatGPT, Claude, Gemini, and Grok for comparison exercises.",
    ],
  },
  {
    title: "Engagement & Community",
    milestone: "m0",
    intro: "The social layer that keeps a cohort moving together: recognition, accountability, and discussion.",
    reqs: [
      "Kudos (kudos table): peer recognition visible to faculty; community posts (community table) moderated via mod.write.",
      "Buddy pairs (buddy_pairs) and buddy check-ins (buddy_checkins) for peer accountability.",
      "Per-day comments (day_comments) and audience-scoped announcements (all / students / faculty / staff).",
      "Leaderboard (/leaderboard) ranked by weekly activity score (activity-score.ts).",
    ],
  },
  {
    title: "Faculty Pods & Mentorship",
    milestone: "m0",
    intro: "Small-group mentorship: students grouped into pods, each owned by onboarded faculty.",
    reqs: [
      "Pods created in /admin/pods; 1+ faculty per pod (pod_faculty), students assigned (pod_members, 1:1 index); pod_events audit log via rpc_pod_faculty_event.",
      "Faculty surfaces: /faculty/today (day overview), /faculty/review (submissions), /faculty/pod (assigned pods), /faculty/handbook.",
      "Faculty pretraining modules + progress (faculty_pretraining_modules) as a structured onboarding gate before grading.",
    ],
  },
  {
    title: "Grading & Submissions",
    milestone: "m0",
    intro: "The assessment loop: students submit work, it is graded against rubrics, and it comes back.",
    reqs: [
      "Submissions: student uploads text and/or link per assignment; assignment kinds lab / capstone / reflection / quiz (assignment_kind enum).",
      "Grading is admin-only (grading.write:cohort); faculty are review-only (grading.read). Per-assignment rubrics (rubrics table).",
      "AI-assisted, rubric-aware grading (lib/actions/grade-submission.ts) via the Vercel AI SDK (Claude / Gemini).",
      "Submission states draft → submitted → graded → returned; peer reviews (peer_reviews table).",
    ],
  },
  {
    title: "Analytics & Pulse",
    milestone: "m0",
    intro: "Cohort visibility for staff plus the daily heartbeat that keeps students engaged.",
    reqs: [
      "Admin analytics (/admin/analytics): completion %, average grades, per-student activity (queries in lib/queries/analytics.ts, cohort-trends.ts, activity-score.ts).",
      "Daily digest email (send-daily-digest edge function) with cohort summaries via Resend.",
      "Notifications table tracking queued / sent / failed delivery.",
    ],
  },
  {
    title: "Capstone & Showcase",
    milestone: "m0",
    intro: "The finale: team-built AI projects, graded as a unit and shown to the whole cohort.",
    reqs: [
      "Team-based capstone (migration 0115): admin CSV import matching roll numbers; locked team roster.",
      "Team submissions: shared title, pitch, chosen_idea, presentation_url, product_url, repo_url, demo_video_url, cover_image_url, status (draft / submitted).",
      "One shared team grade + feedback by admin; all members see the same result.",
      "Public showcase gallery (/showcase): every team's card visible to enrolled students with embedded presentation / live site and a per-team member table.",
    ],
  },
  {
    title: "Refinement & Polish",
    milestone: "m0",
    intro: "The finishing pass that makes the cohort feel finished: certificates, theming, and shared UI.",
    reqs: [
      "Downloadable / printable completion certificate (≥50% assignment completion; admin override of the soft-launch gate; dynamic name overlay on the template).",
      "Dark / light theme via next-themes (data-theme) with Tailwind v4 tokens; toast notifications via Sonner.",
      "Reusable shell components: generic filterable / sortable data-table, KPI cards, and day / pod / student cards.",
    ],
  },
  {
    title: "AI Tutoring & Help Chat",
    milestone: "m1",
    intro: "Turn the existing help desk into a first-line AI tutor, with faculty as the escalation path.",
    reqs: [
      "Help desk (/help-desk): students file 'stuck' tickets (content / tech / team / other); faculty triage + escalate (support.triage, support.escalate).",
      "AI SDK groundwork already in place (@ai-sdk/anthropic, @ai-sdk/google) — not yet an automated tutor bot.",
      "Planned: curriculum- and rubric-aware AI answers wired into the help desk, escalating to faculty when unsure.",
    ],
  },
  {
    title: "Payments & Enrollment Billing",
    milestone: "m2",
    intro: "Make confirmed enrollment payment-driven instead of a manual admin step.",
    reqs: [
      "Not yet built. Registration tiers (pending / confirmed / waitlist / cancelled) and promo codes (promo_codes, use tracking) already exist; admin manually confirms enrollment today.",
      "Planned: payment-gateway integration so a confirmed registration is payment-backed, with receipts.",
      "Planned: promo-code discounts applied at checkout and reconciled against registration source.",
    ],
  },
  {
    title: "Mobile-First & PWA",
    milestone: "m2",
    intro: "Make day reading and submissions installable and usable on a phone, even offline.",
    reqs: [
      "Not yet built. The responsive shell is already in place (Tailwind, shadcn primitives).",
      "Planned: service worker + web manifest for an installable, offline-capable app.",
      "Planned: offline day reading and queued submissions that sync when back online.",
    ],
  },
  {
    title: "Gamification & Engagement",
    milestone: "m3",
    intro: "Layer game mechanics on top of the engagement signals the platform already tracks.",
    reqs: [
      "Foundations shipped: the activity-score leaderboard, kudos, and the buddy system.",
      "Planned: an XP / badges layer built on the existing activity score.",
      "Planned: streaks and milestone rewards tied to daily completion and submissions.",
    ],
  },
];

// ---- reference Docs mirroring the real repo ----
const REF_DOCS: { title: string; icon: string; nodes: Node[] }[] = [
  {
    title: "RBAC & Capabilities",
    icon: "🔐",
    nodes: [
      h(1, "RBAC & Capabilities"),
      p("The single source of truth for access control across the LMS."),
      bullets([
        "6 personas: admin, trainer, tech_support, support_faculty, executive_faculty, student.",
        "20+ capabilities (content.read, grading.write, mod.write, support.triage, …) in web/lib/rbac/capabilities.ts.",
        "Resolved at the database by the auth_caps(cohort) SECURITY DEFINER function, enforced by RLS on every table.",
        "Menus filtered per persona in lib/rbac/menus.ts; violations land on /denied.",
      ]),
      p("Source: web/lib/rbac/capabilities.ts and the pgTAP RBAC assertions in supabase/tests/rbac.sql."),
    ],
  },
  {
    title: "Data Model & Schema",
    icon: "🗂️",
    nodes: [
      h(1, "Data Model & Schema"),
      p("Supabase Postgres schema built up across ordered migrations (0001 → 0115+)."),
      bullets([
        "Identity & enrollment: profiles, registrations, cohorts, cohort_days.",
        "Pods & faculty: pods, pod_faculty, pod_members, pod_events, faculty_pretraining_modules.",
        "Assessment: assignments, submissions, rubrics, peer_reviews, teams, team_submissions, team_grades.",
        "Engagement: kudos, community, buddy_pairs, buddy_checkins, day_comments, announcements, notifications.",
        "Enums: registration_status, assignment_kind, submission_status, pod_event_kind, day_capstone_kind.",
      ]),
      p("Source: supabase/migrations/0001_init_schema.sql and onward."),
    ],
  },
  {
    title: "Curriculum & Content Model",
    icon: "📚",
    nodes: [
      h(1, "Curriculum & Content Model"),
      p("How the 30 days are authored, validated, and delivered."),
      bullets([
        "One MDX file per day (web/content/day-01.mdx → day-30.mdx) with Zod-validated frontmatter (web/lib/content/schema.ts).",
        "Frontmatter fields: date, weekday, topic, faculty, tldr, prompt_of_the_day, online_tools, reading_time, lab, objectives, tags.",
        "Per-day scheduling/state lives in cohort_days (unlock, live_session_at, meet_link, capstone_kind).",
        "Rendered server-side via next-mdx-remote/rsc + remark-gfm; gated by content.read.",
      ]),
    ],
  },
  {
    title: "Capstone Team Model",
    icon: "🏆",
    nodes: [
      h(1, "Capstone Team Model"),
      bullets([
        "Admin-managed locked teams via CSV import matching roll numbers.",
        "Per-team shared submission (title, pitch, chosen_idea, presentation/product/repo/demo URLs, cover image).",
        "One graded score + feedback per team; every member sees the same result.",
        "Showcase gallery public to all enrolled cohort members, with embedded presentation / live site.",
      ]),
      p("Source: docs/superpowers/specs/capstone-team-submissions.md and migration 0115."),
    ],
  },
  {
    title: "Edge Functions & Notifications",
    icon: "✉️",
    nodes: [
      h(1, "Edge Functions & Notifications"),
      bullets([
        "send-daily-digest: cohort summary email via Resend, gated by EDGE_FUNCTION_SHARED_SECRET.",
        "send-registration-email: enrollment confirmation via Resend.",
        "Notification queue + status tracking (queued / sent / failed) in the notifications table.",
        "Deployed to Supabase Functions; triggered on a schedule (cron).",
      ]),
      p("Source: supabase/functions/send-daily-digest, supabase/functions/send-registration-email."),
    ],
  },
  {
    title: "Deployment & Operations",
    icon: "🚀",
    nodes: [
      h(1, "Deployment & Operations"),
      bullets([
        "Single Next.js 15 app under web/, deployed to Vercel via GitHub (no local Vercel CLI).",
        "Supabase Cloud backend; migrations applied in order from supabase/migrations/.",
        "Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, EDGE_FUNCTION_SHARED_SECRET.",
      ]),
      p("Source: README.md, RUNBOOK.md, CLAUDE.md."),
    ],
  },
  {
    title: "Testing & CI",
    icon: "✅",
    nodes: [
      h(1, "Testing & CI"),
      bullets([
        "GitHub Actions (.github/workflows/ci.yml): typecheck, lint, vitest (unit + component), build.",
        "Migrations run against a stubbed Postgres in CI.",
        "RBAC enforced as a spec: pgTAP assertions in supabase/tests/rbac.sql cover every capability and RLS rule.",
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
    .where(and(eq(schema.projects.workspaceId, ws.id), eq(schema.projects.name, "AI Workshop")))
    .limit(1);
  if (!project) return console.log("No AI Workshop project.");

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
      p("Release phases for AI Workshop and the requirements behind each. Per-feature requirements also live on each feature's spec in the Product roadmap."),
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

  console.log("Done — AI Workshop roadmap seeded.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
