import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq, isNull, max } from "drizzle-orm";

import { db, schema } from "./index";

/**
 * Seed the Valytica go-to-market initiative into the hub:
 * - a WhatsApp-launch brief + Marketing campaign + content deliverables
 * - a "GTM & WhatsApp Launch Readiness" roadmap feature + engineering tickets
 * - a "Go-To-Market" Docs tree: Pricing & Packaging, Positioning & ICP,
 *   GTM Launch Plan, Analytics & KPIs (all grounded in the real valytica repo)
 * - cross-functional launch tasks under the GTM milestone, spanning the new
 *   functional task types (engineering/finance/legal/research/product/sales)
 *
 * Enterprise inquiries route into Sales (CRM); feedback into Support — no new
 * department. Nothing is fabricated: every figure traces to the valytica code,
 * and missing market data is tracked as a research task, not invented.
 * Idempotent (upserts by title). Run: npm run db:seed-valytica-gtm
 */

const EMAIL: Record<string, string> = {
  sandeep: "sandeep@gnanalytica.com",
  jay: "jayasaagar@gnanalytica.com",
  aparna: "aparna@gnanalytica.com",
  sanjana: "sanjana@gnanalytica.com",
  raunak: "raunak@gnanalytica.com",
  harshith: "harshith@gnanalytica.com",
  shravani: "shravani@gnanalytica.com",
};

const SALES_EMAIL = "sales@gnanalytica.com";
const SUPPORT_EMAIL = "support@gnanalytica.com";

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

const BRIEF = doc(
  h(1, "Valytica · WhatsApp Launch — brief"),
  p("Deliverables and supporting materials for the WhatsApp marketing campaign. Campaign + content live in Marketing; inbound enterprise inquiries route into Sales; in-app build items are Engineering tickets under the GTM Launch Readiness feature."),
  h(2, "1. WhatsApp marketing message"),
  p("A concise, engaging message that communicates Valytica's value proposition."),
  h(2, "2. Demo video (feature showcase)"),
  bullets([
    "Data extraction: upload valuation documents → AI extraction of property details.",
    "AI property value suggestions: show at least two AI-generated valuations from the uploaded docs.",
    "Report generation: produce the final report; highlight speed, accuracy and professional format.",
  ]),
  h(2, "3. Sample report"),
  p("A sample valuation report for demos and self-testing."),
  h(2, "4. Valytica landing page"),
  p("valytica.gnanalytica.com fully functional and public-ready, with an apt professional logo aligned to the Gnanalytica brand."),
  h(2, "5. User activity & analytics"),
  bullets([
    "Registered users, document uploads, report generations.",
    "Email IDs of users who performed these actions.",
    "Page-/module-wise activity logs where applicable.",
  ]),
  h(2, "6. Feedback form"),
  p("A simple in-app form for users to submit experience, suggestions or issues."),
  h(2, "7. Custom requirements & support"),
  p(`Enterprise / custom requirements CTA on the landing page + app footer → ${SALES_EMAIL} (inquiries become Sales leads). General support / feedback → ${SUPPORT_EMAIL} (becomes Support tickets).`),
);

// Marketing content deliverables (#1–#3).
const CONTENT: { title: string; status: string; who: string; notes: string; url?: string }[] = [
  {
    title: "WhatsApp marketing message — Valytica value prop",
    status: "draft",
    who: "shravani",
    notes:
      "Hook: AI-assisted valuations for Indian valuers. Upload docs → AI extracts property details → get value suggestions → generate an IBA-format report in minutes. CTA: reply to try a free sample report.",
  },
  {
    title: "Demo video: extraction → AI value suggestions → report",
    status: "idea",
    who: "shravani",
    notes: "Screen-record the full journey: upload → AI extraction → ≥2 AI value suggestions → final report. ~60–90s.",
  },
  {
    title: "Sample valuation report (demo + self-test)",
    status: "idea",
    who: "aparna",
    notes: "Generate a polished sample report via the app for demos and prospects to self-test against.",
  },
];

// GTM build feature → engineering/product tickets (#4–#7 + sample-report artifact).
type IssueStatus = "backlog" | "todo" | "in_progress" | "in_review" | "done";
const GTM_TICKETS: [title: string, who: string, status: IssueStatus][] = [
  ["Landing page valytica.gnanalytica.com — production-ready public site", "raunak", "todo"],
  ["Valytica logo aligned to the Gnanalytica brand identity", "shravani", "in_progress"],
  ["In-app Activity & Analytics page (users, uploads, report gens, emails, module logs)", "raunak", "todo"],
  ["Activity event logging + analytics data layer", "harshith", "todo"],
  ["In-app feedback form (experience, suggestions, bug reports)", "raunak", "todo"],
  [`Route feedback submissions → Support tickets (${SUPPORT_EMAIL})`, "harshith", "backlog"],
  [`Enterprise / custom-requirements CTA (landing + footer → ${SALES_EMAIL})`, "raunak", "todo"],
  ["Route enterprise inquiries → Sales CRM (leads/deals)", "harshith", "backlog"],
];

// ---- GTM strategy docs (grounded in the valytica repo) ----
const GTM_DOCS: { title: string; icon: string; nodes: Node[] }[] = [
  {
    title: "Pricing & Packaging",
    icon: "💰",
    nodes: [
      h(1, "Pricing & Packaging"),
      p("Grounded in the live Valytica billing code. Plan tiers and the prepaid wallet are real; items marked (decision) or (not yet built) are flagged, not assumed."),
      h(2, "Plans"),
      bullets([
        "Free — ₹0. 3 reports included, watermarked. Monthly AI budget ₹200. Default for every new organisation.",
        "Individual — ₹499/mo. Unlimited reports, no watermark. Monthly AI budget ₹2,000.",
        "Team — ₹1,999/mo (marked “Popular”). Multi-user firm with a shared wallet; custom branding + analytics. Monthly AI budget ₹10,000.",
        "Business — custom, postpaid. Dedicated support and API access; contact sales@gnanalytica.com. Monthly AI budget ₹50,000 (Enterprise ceiling ₹2,00,000).",
      ]),
      h(2, "Pay-per-report (wallet)"),
      bullets([
        "₹200 per finalised report (REPORT_COST_INR), debited atomically from a prepaid wallet (charge_org_for_report RPC, race-safe).",
        "After the 3 free reports, an org needs ≥₹200 wallet balance to finalise a report.",
        "Wallet recharge amounts: ₹100 / ₹500 / ₹1,000 / ₹5,000 (custom min ₹100).",
      ]),
      h(2, "What's gated"),
      bullets([
        "Watermark: free / trial reports are watermarked; paid tiers are not.",
        "AI budget ceilings per plan enforce monthly model spend (quota mode warn → enforce).",
      ]),
      h(2, "Billing status (as built)"),
      bullets([
        "Wallet recharge is LIVE end-to-end: Razorpay order + HMAC-verified webhook credits the wallet on payment.captured.",
        "Plan subscriptions are STUBBED — billing/actions.ts has a TODO(razorpay); upgrades currently flip the plan without charging. This is the revenue go-live blocker.",
      ]),
      h(2, "Open decisions"),
      bullets([
        "Annual billing / discount — not in code; decide before the pricing page ships. (decision)",
        "Trial design — 3 free watermarked reports vs a time-boxed trial. (decision)",
        "Team “custom branding + analytics” and Business “API” are advertised but not yet built — confirm scope or adjust the tier copy. (not yet built)",
      ]),
      p("Sources: src/lib/billing.ts (REPORT_COST_INR), src/lib/ai/quota.ts (budgets), billing/billing-client.tsx (tiers + recharge), api/billing/razorpay/* (wallet), billing/actions.ts (subscription TODO)."),
    ],
  },
  {
    title: "Positioning & ICP",
    icon: "🎯",
    nodes: [
      h(1, "Positioning & ICP"),
      p("Truthful positioning drawn from the product as built. Market sizing and competitor analysis do not yet exist and are tracked as research — no numbers are asserted here."),
      h(2, "One-liner"),
      p("An AI valuation copilot for Indian valuers: upload property and loan documents, get AI-extracted and source-cited facts, compute a defensible value three ways, and generate bank-ready reports in minutes."),
      h(2, "What it does"),
      bullets([
        "Four engagement types: Valuation (IVS / IBBI), TEV, LIE, DPR.",
        "Ingests 14 document types (sale deed, EC, tax receipt, approved plan, RERA, RTC, …) as PDF / PNG / JPEG / WebP.",
        "Gemini extraction with confidence scores + source citations; cross-document conflict detection; ≥0.8-confidence auto-fill into empty fields only.",
        "Three valuation approaches (cost / comparable sales / income), with comparables retrieved from the firm's own finalised cases via pgvector.",
        "Android field app for site visits: GPS-geotagged photos, voice notes, checklists.",
        "Outputs: IBBI PDF + bank-format .docx (e.g. SBI), with AI-drafted, fact-checked narrative.",
      ]),
      h(2, "Why it's different (grounded)"),
      bullets([
        "India-only data residency (Supabase Mumbai, Vercel bom1, AWS SES Mumbai); DPDP-aware.",
        "Human-in-the-loop by design — never fabricates official portal results, never overwrites a human-entered value.",
        "Bank-ready deliverables, not just a number — purpose-driven basis of value (loan origination / SARFAESI / capital gains).",
        "Comparables grounded in the firm's own history, org-isolated by RLS.",
      ]),
      h(2, "Validated pains (user interviews)"),
      bullets([
        "Maintenance of records / cases over time.",
        "Cross-referencing across documents and prior cases.",
        "Tracking status and progress across a high case volume.",
        "Audit trail and defensibility of every figure.",
        "Time taken per report; throughput under volume.",
      ]),
      h(2, "ICP — sharpened by interviews; formalize in #122"),
      bullets([
        "Independent IBBI-registered valuers doing bank-mandated property valuations.",
        "Valuation firms on bank panels handling volume.",
        "TEV / LIE / DPR consultants and lender's independent engineers.",
      ]),
      h(2, "TBD — needs research (do not fabricate)"),
      bullets([
        "Market size (number of registered valuers / firms; annual bank-valuation volume).",
        "Competitive landscape and incumbent pricing.",
        "Willingness to pay vs the ₹200/report and ₹499–₹1,999/mo points.",
      ]),
      p("Tracked as the “Market sizing & competitive research” task. Sources: engagement.ts, document-types.ts, billing.ts, ARCHITECTURE.md."),
    ],
  },
  {
    title: "GTM Launch Plan",
    icon: "🚀",
    nodes: [
      h(1, "GTM Launch Plan"),
      p("How Valytica goes to market. The WhatsApp campaign brief, content and build tickets live alongside this doc; this is the cross-functional plan and the go / no-go gate."),
      h(2, "Business model — two engines"),
      bullets([
        "SaaS (self-serve, the “initial taste”): valuers run reports themselves — ₹200/report + ₹499 / ₹1,999 plans. Proves value, gathers usage, seeds the comparables index. Recurring revenue is blocked until subscriptions ship (#119).",
        "Enterprise (build & co-own): custom-build to a bank / firm's requirements, then co-own, hand over, or run as managed support. Sales-led, high-ACV; taps the services market and bills via contracts (not Razorpay) — needs GST (#120) + ToS (#121).",
      ]),
      h(2, "Motion"),
      bullets([
        "WhatsApp outreach to valuers → free sample report (3 free, watermarked) → wallet top-up / paid plan.",
        "Enterprise / custom inquiries → sales@gnanalytica.com → Sales CRM.",
        "Feedback → support@gnanalytica.com → Support tickets.",
      ]),
      h(2, "Readiness (as built)"),
      bullets([
        "Live: case lifecycle, AI extraction & verification, 3-way valuation, IBBI / bank reports, prepaid wallet billing (m0 / m1).",
        "Wallet recharge works end-to-end via Razorpay.",
      ]),
      h(2, "Blockers before charging real money"),
      bullets([
        "Razorpay plan subscriptions are stubbed — paid upgrades don't actually charge. (engineering, blocker)",
        "No public landing or pricing page yet at valytica.gnanalytica.com. (marketing)",
        "No Terms of Service / refund-cancellation / updated Privacy Policy for paid use — Razorpay requires these. (legal)",
        "GST tax-invoice flow for recharges / subscriptions unverified. (finance)",
        "Only $pageview is instrumented — the conversion funnel isn't measurable yet. (product)",
      ]),
      h(2, "Go / no-go criteria"),
      bullets([
        "Subscriptions charge successfully in production (or launch wallet-only and hide plan upgrades).",
        "Public landing + pricing page live with accurate tier copy.",
        "ToS, refund / cancellation and privacy pages published.",
        "Activation + monetisation funnel events firing in PostHog.",
      ]),
      p("Cross-functional tasks for each blocker are tracked under the “GTM · WhatsApp Launch” milestone."),
    ],
  },
  {
    title: "Analytics & KPIs",
    icon: "📊",
    nodes: [
      h(1, "Analytics & KPIs"),
      p("What we can measure, what we want to measure, and the instrumentation gap between them. No values are asserted — these are definitions and targets."),
      h(2, "Measurable today"),
      bullets([
        "PostHog: $pageview only (EU host, identified-only profiles), env-gated.",
        "Sentry: client errors in production (10% trace sample).",
        "audit_logs: server-side events incl. report-finalisation billing.",
      ]),
      h(2, "Funnel & KPIs to define"),
      bullets([
        "Acquisition → signup (email / phone / Google OTP).",
        "Activation → first case created → first report finalised.",
        "Monetisation → wallet recharge; paid plan upgrade; ₹200/report consumption.",
        "Retention → repeat reports per org per month; weeks-active.",
      ]),
      h(2, "North-star candidate"),
      p("Finalised reports per active organisation per month — it ties product value (a delivered valuation) to revenue (₹200/report + plan)."),
      h(2, "Instrumentation gap → events to add"),
      bullets([
        "identify(org, plan) on sign-in; signup_completed.",
        "case_created, document_uploaded, extraction_completed.",
        "report_finalised (with charge source: free / wallet).",
        "wallet_recharge_succeeded, plan_upgrade_succeeded.",
        "feedback_submitted, enterprise_cta_clicked.",
      ]),
      p("Sources: posthog-provider.tsx (pageview only), instrumentation-client.ts (Sentry), audit.ts."),
    ],
  },
];

// ---- cross-functional launch tasks (Milestone → Task, varied functional types) ----
const XFN_TASKS: {
  title: string;
  type: string;
  priority: string;
  status: IssueStatus;
  desc: string;
  reqs: string[];
}[] = [
  {
    title: "Wire Razorpay plan subscriptions — revenue go-live blocker",
    type: "engineering",
    priority: "urgent",
    status: "todo",
    desc: "Wallet recharge is live, but plan subscriptions are stubbed (TODO(razorpay) in billing/actions.ts) — paid upgrades flip the plan without charging, so ₹499/₹1,999 revenue can't flow.",
    reqs: [
      "Razorpay subscription / checkout for plan upgrades.",
      "Webhook performs the plan flip on payment, idempotently.",
      "Handle proration, downgrade and cancellation.",
      "Fallback: hide plan upgrades and launch wallet-only if not ready by go-live.",
    ],
  },
  {
    title: "GST-compliant tax invoices for wallet recharges & subscriptions",
    type: "finance",
    priority: "high",
    status: "backlog",
    desc: "Indian B2B buyers need GST tax invoices. Validate invoice generation for wallet recharges and (once live) subscriptions before charging real money.",
    reqs: [
      "Tax invoice with GSTIN, HSN / SAC, place of supply.",
      "Sequential, auditable invoice numbering.",
      "Download / email from the billing page.",
      "Reconcile against billing_transactions.",
    ],
  },
  {
    title: "Terms of Service, refund/cancellation & Privacy Policy for paid launch",
    type: "legal",
    priority: "high",
    status: "backlog",
    desc: "Razorpay and DPDP require published Terms of Service, a refund / cancellation policy, and an updated Privacy Policy before taking payments. Sub-processors are already listed in /privacy §6.",
    reqs: [
      "Terms of Service.",
      "Refund & cancellation policy (wallet + subscriptions).",
      "Privacy Policy updated for paid use + DPDP.",
      "Linked from signup, checkout and footer.",
    ],
  },
  {
    title: "Market sizing & competitive research (validate ICP, willingness to pay)",
    type: "research",
    priority: "medium",
    status: "backlog",
    desc: "No market or competitor analysis exists in either repo. Size the market and validate the ICP and price points before scaling spend — do not assume.",
    reqs: [
      "Count of IBBI-registered valuers / valuation firms.",
      "Annual bank-valuation volume.",
      "Competitor scan + incumbent pricing.",
      "Willingness-to-pay vs ₹200/report and ₹499–₹1,999/mo.",
    ],
  },
  {
    title: "Instrument PostHog activation & conversion funnel events",
    type: "product",
    priority: "high",
    status: "todo",
    desc: "Only $pageview is tracked today, so the activation / conversion funnel is invisible. Instrument the events needed to measure the KPIs in the Analytics & KPIs doc.",
    reqs: [
      "identify(org, plan) + signup_completed.",
      "case_created, document_uploaded, extraction_completed.",
      "report_finalised (with charge source).",
      "wallet_recharge_succeeded, plan_upgrade_succeeded.",
    ],
  },
  {
    title: "Confirm launch pricing & packaging (annual, trial vs 3-free, tier scope)",
    type: "product",
    priority: "medium",
    status: "backlog",
    desc: "Tiers are coded (Free / ₹499 / ₹1,999 / custom + ₹200/report) but annual billing, trial design, and whether Team branding/analytics and Business API are in scope are open.",
    reqs: [
      "Annual plan + discount, or not.",
      "Trial: 3 free watermarked reports vs time-boxed.",
      "Team custom-branding / analytics scope.",
      "Business API scope, or remove it from the tier copy.",
    ],
  },
  {
    title: "Define Business/Enterprise sales motion + sales@ qualification & API scope",
    type: "sales",
    priority: "medium",
    status: "backlog",
    desc: "Business is “custom, contact sales@”. Define how enterprise deals are qualified, priced and closed, and scope the advertised API.",
    reqs: [
      "Qualification criteria + sales@ routing into the CRM.",
      "Pricing approach for postpaid / custom.",
      "Demo + sample-report flow.",
      "API scope (currently not built).",
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
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(and(eq(schema.projects.workspaceId, ws.id), eq(schema.projects.name, "Valytica")))
    .limit(1);
  if (!project) return console.log("No Valytica project.");

  const users = await db.select({ id: schema.users.id, email: schema.users.email }).from(schema.users);
  const byEmail = new Map(users.map((u) => [u.email, u.id]));
  const uid = (k: string) => byEmail.get(EMAIL[k]) ?? null;

  // 1. Brief page
  const briefTitle = "Valytica · WhatsApp Launch — brief";
  // The brief is a project Doc (scoped to Valytica), not a company-wiki page.
  const [pageExists] = await db
    .select({ id: schema.pages.id })
    .from(schema.pages)
    .where(
      and(
        eq(schema.pages.workspaceId, ws.id),
        eq(schema.pages.projectId, project.id),
        eq(schema.pages.title, briefTitle),
      ),
    )
    .limit(1);
  if (!pageExists) {
    await db.insert(schema.pages).values({
      workspaceId: ws.id,
      projectId: project.id,
      title: briefTitle,
      icon: "📣",
      content: BRIEF,
      contentText: plain(BRIEF).slice(0, 20000),
      creatorId: uid("jay"),
    });
  }

  // 2. Marketing campaign + content
  const campName = "Valytica · WhatsApp Launch";
  let [campaign] = await db
    .select({ id: schema.campaigns.id })
    .from(schema.campaigns)
    .where(and(eq(schema.campaigns.workspaceId, ws.id), eq(schema.campaigns.name, campName)))
    .limit(1);
  if (!campaign) {
    [campaign] = await db
      .insert(schema.campaigns)
      .values({
        workspaceId: ws.id,
        projectId: project.id,
        name: campName,
        channel: "whatsapp",
        status: "active",
        budget: 5000,
        entity: "India",
        ownerId: uid("shravani"),
        startDate: new Date("2026-06-25T12:00:00Z"),
        endDate: new Date("2026-07-31T12:00:00Z"),
      })
      .returning({ id: schema.campaigns.id });
  }

  const existingContent = await db
    .select({ title: schema.contentItems.title })
    .from(schema.contentItems)
    .where(eq(schema.contentItems.workspaceId, ws.id));
  const haveContent = new Set(existingContent.map((c) => c.title));
  let contentCount = 0;
  for (const c of CONTENT) {
    if (haveContent.has(c.title)) continue;
    await db.insert(schema.contentItems).values({
      workspaceId: ws.id,
      projectId: project.id,
      campaignId: campaign.id,
      title: c.title,
      channel: "whatsapp",
      status: c.status,
      url: c.url ?? null,
      notes: c.notes,
      ownerId: uid(c.who),
    });
    contentCount++;
  }

  // 3. GTM roadmap feature + engineering tickets
  const featTitle = "GTM & WhatsApp Launch Readiness";
  const [featExists] = await db
    .select({ id: schema.features.id })
    .from(schema.features)
    .where(and(eq(schema.features.projectId, project.id), eq(schema.features.title, featTitle)))
    .limit(1);
  let ticketCount = 0;
  if (!featExists) {
    const start = new Date("2026-06-20T12:00:00Z");
    const target = new Date("2026-07-31T12:00:00Z");
    const [feature] = await db
      .insert(schema.features)
      .values({
        workspaceId: ws.id,
        projectId: project.id,
        title: featTitle,
        status: "building",
        startDate: start,
        targetDate: target,
        spec: doc(
          p("Launch-readiness work for the WhatsApp campaign: public landing page + logo, in-app activity/analytics, feedback form, and the enterprise-contact CTA. See the linked brief."),
        ),
        ownerId: uid("jay"),
        sortKey: "a99",
      })
      .returning({ id: schema.features.id });

    // pick the cycle covering each ticket's createdAt
    const cycles = await db
      .select({ id: schema.cycles.id, startDate: schema.cycles.startDate, endDate: schema.cycles.endDate })
      .from(schema.cycles)
      .where(eq(schema.cycles.workspaceId, ws.id));
    const cycleFor = (dt: Date) => cycles.find((c) => dt >= c.startDate && dt <= c.endDate)?.id ?? null;

    const [{ value: maxNum }] = await db
      .select({ value: max(schema.issues.number) })
      .from(schema.issues)
      .where(and(eq(schema.issues.workspaceId, ws.id), eq(schema.issues.projectId, project.id)));
    let issueNum = maxNum ?? 0;
    const span = target.getTime() - start.getTime();
    const priorities = ["high", "high", "medium", "medium", "medium", "low", "high", "low"];
    for (let i = 0; i < GTM_TICKETS.length; i++) {
      const [title, who, status] = GTM_TICKETS[i];
      const createdAt = new Date(start.getTime() + (span * (i + 0.5)) / GTM_TICKETS.length);
      await db.insert(schema.issues).values({
        workspaceId: ws.id,
        projectId: project.id,
        featureId: feature.id,
        cycleId: cycleFor(createdAt),
        number: ++issueNum,
        title,
        status,
        priority: priorities[i % priorities.length],
        assigneeId: uid(who),
        creatorId: uid("jay"),
        sortKey: `a${String(i).padStart(3, "0")}`,
        createdAt,
        updatedAt: createdAt,
      });
      ticketCount++;
    }
  }

  // 4. Go-To-Market Docs tree (Pricing, Positioning & ICP, Launch Plan, KPIs).
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
      creatorId: uid("jay"),
      position,
    };
    if (existing) {
      await db.update(schema.pages).set(values).where(eq(schema.pages.id, existing.id));
      return existing.id;
    }
    const [created] = await db.insert(schema.pages).values(values).returning({ id: schema.pages.id });
    return created.id;
  }

  const gtmParent = await upsertPage(
    "Go-To-Market",
    "📣",
    doc(
      h(1, "Go-To-Market"),
      p("Valytica's GTM home: pricing, positioning, the launch plan and the KPIs we'll measure. Grounded in the product as built; market data we don't have is tracked as research, not invented."),
    ),
    null,
    "g00",
  );
  let gi = 0;
  for (const d of GTM_DOCS) {
    await upsertPage(d.title, d.icon, doc(...d.nodes), gtmParent, `g${String(gi + 1).padStart(2, "0")}`);
    gi++;
  }

  // 5. Cross-functional launch tasks under the GTM milestone (Milestone → Task).
  const [gtmMs] = await db
    .select({ id: schema.milestones.id })
    .from(schema.milestones)
    .where(
      and(
        eq(schema.milestones.projectId, project.id),
        eq(schema.milestones.name, "GTM · WhatsApp Launch"),
      ),
    )
    .limit(1);

  const existingTitles = new Set(
    (
      await db
        .select({ title: schema.issues.title })
        .from(schema.issues)
        .where(and(eq(schema.issues.workspaceId, ws.id), eq(schema.issues.projectId, project.id)))
    ).map((r) => r.title),
  );
  const [{ value: maxXfn }] = await db
    .select({ value: max(schema.issues.number) })
    .from(schema.issues)
    .where(and(eq(schema.issues.workspaceId, ws.id), eq(schema.issues.projectId, project.id)));
  let xfnNum = maxXfn ?? 0;
  let xfnCount = 0;
  for (let i = 0; i < XFN_TASKS.length; i++) {
    const t = XFN_TASKS[i];
    if (existingTitles.has(t.title)) continue;
    await db.insert(schema.issues).values({
      workspaceId: ws.id,
      projectId: project.id,
      milestoneId: gtmMs?.id ?? null,
      number: ++xfnNum,
      title: t.title,
      type: t.type,
      status: t.status,
      priority: t.priority,
      description: doc(p(t.desc), h(2, "Acceptance criteria"), bullets(t.reqs)),
      creatorId: uid("jay"),
      sortKey: `g${String(i).padStart(3, "0")}`,
    });
    xfnCount++;
  }

  console.log(
    `Valytica GTM seeded: brief page, campaign, ${contentCount} content items, ` +
      `${ticketCount} tickets, ${GTM_DOCS.length + 1} GTM docs, ${xfnCount} cross-functional tasks.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
