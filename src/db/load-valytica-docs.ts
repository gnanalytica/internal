import { config } from "dotenv";
config({ path: ".env.local" });
import { eq, and, isNull } from "drizzle-orm";
import { db } from "./index";
import { projects, pages, users } from "./schema";
import { markdownToDoc, docToText } from "../lib/markdown";

/** Load the Valytica plan docs as pages. Re-runnable: replaces by title. */

const OVERVIEW = `
Valytica's MVP launch runs as a **waterfall program to a gate, then agile**. Scope is frozen
after PRD v2; the launch date comes off the critical path; from 25 Sep the team switches to
one-week sprints. Source: the MVP Launch Plan, the Detailed WBS, and the Roadmap Diagram.

## The shape

| | Pre-launch | Post-launch |
|---|---|---|
| Method | Waterfall — WBS + gates | Agile — 6 one-week sprints |
| Window | Fri 14 Aug → Thu 24 Sep 2026 | Fri 25 Sep → Thu 5 Nov 2026 |
| Optimises for | Completeness | Learning speed |
| Scope changes | Change request, gated by Jay + Sandeep | Re-prioritised each sprint |
| Hard stop | Launch Thu 24 Sep | MVP closes Thu 5 Nov |

## Critical path — the four items that decide the launch date

| # | Ticket | Owner | Gate | Due |
|---|---|---|---|---|
| 1 | SET-01 | Sandeep | Ticketing live end-to-end | Thu 13 Aug |
| 2 | AIE-01 | Raunak & Gopal | 50+ labelled documents in hand | Thu 20 Aug |
| 3 | FS-01…FS-11 | Raunak & Gopal | Feature complete, zero unstarted tickets | Thu 10 Sep |
| 4 | SAL-09 | Shravani | 5 leads confirmed in writing | Thu 17 Sep |

If any of these four slip, 24 Sep moves. Everything else can be absorbed.

## Risk register

| Risk | Impact | Mitigation | Owner |
|---|---|---|---|
| Extraction tuning starts W2 instead of W1 | Breaks the 4-week engineering envelope | Corpus is a W1 deliverable with a named owner | Raunak & Gopal |
| Real labelled documents not available | Accuracy target unverifiable | Source deliberately — see open decision below | Raunak & Gopal |
| State portals block or rate-limit automation | Verification step degrades | Manual-assisted fallback built in W3, not discovered in W5 | Harshith |
| Sales ramps slowly | 5-lead goal missed | Lead list ready before calling starts; training then calls by W2 | Shravani |
| One QA week covers functional + security | Escapes into production | Test cases written in W4; W5 executes only | Aparna |
| Scope creep after the 20 Aug freeze | Launch date slips | All new asks → post-launch backlog, Jay/Sandeep gate | Jay |
| Ganesh Chaturthi in launch week | Team + user availability | Verify the date; shift launch if it collides | Sandeep |
| Marketing waits on LinkedIn automation | Campaign delayed | Manual scheduling from W2; automation is an enhancement | Shravani |
| Two people carry both extraction and the app build | Serial work dressed as parallel | Flagged in the WBS as the tightest resource risk — unresolved | Sandeep |

## Open decisions

- **Where the 50+ document corpus comes from.** AIE-01 is due Thu 20 Aug and the stated mitigation is "source from pilot valuers during Week 1 lead calls" — but first calls begin Tue 25 Aug, five days later. The corpus needs another source.
- **What happens if extraction lands below 90%.** AIE-06 targets 90% on key fields by Thu 10 Sep with no defined branch at, say, 82% — launch with heavier manual review, slip, or narrow the key-field set.
- **Ganesh Chaturthi vs launch week.** Flagged three times across the plan, never assigned to anyone.
- **DPDP.** Listed under MVP Engineering in the roadmap diagram; no ticket exists for it in the WBS.
- **Pricing.** Free 3 / ₹499 / ₹1,999 / Custom is enforced in FS-02.3 in W2, while pricing validation (MR-03) is P2 in the same week.

## How this project is organised

Tasks live on the board, not in these pages — 379 issues across 125 parents, each carrying its
Definition of Done, owner, estimate in hours, week cycle and dependencies. These pages hold the
narrative: what each track is doing week by week, and what it is measured on.
`;

const MASTER = `
Window: Fri 14 Aug 2026 → Thu 24 Sep 2026 (6 weeks). Launch Thu 24 Sep — hard stop.
Post-launch stabilisation Fri 25 Sep → Thu 5 Nov 2026 (6 sprints, hard stop for MVP).
Tech prioritisation — Sandeep · Non-tech prioritisation — Jay.

## Master calendar

| Week | Dates | Product | Engineering | Marketing | Sales |
|---|---|---|---|---|---|
| W0 | → Thu 13 Aug | — | Tracker live | — | — |
| W1 | Fri 14 – Thu 20 Aug | PRD, logo, tagline, target user | Doc corpus + extraction baseline | Compile content + videos | Lead list build |
| W2 | Fri 21 – Thu 27 Aug | UX/UI review, feedback loop | FE changes + BE start | LinkedIn live, IG trailer | Training, first calls |
| W3 | Fri 28 Aug – Thu 3 Sep | Scope hold, no new asks | Backend core | Blogs, newsletter, WhatsApp | Active calling |
| W4 | Fri 4 – Thu 10 Sep | Acceptance criteria sign-off | Backend complete, feature freeze | Downloadables, webinar | Follow-ups, demos |
| W5 | Fri 11 – Thu 17 Sep | QA oversight | Functional + non-functional QA | Launch content queued | 5 leads confirmed |
| W6 | Fri 18 – Thu 24 Sep | Go / No-Go | Staging → Prod | Launch sequence | Onboard leads |
| Post | Fri 25 Sep – Thu 5 Nov | Agile, 6 sprints | Analytics + fixes | Ongoing | Conversions |

## Engineering effort — estimate vs. reality

The 4-week envelope (FE 0.5w + BE 1.5w + BE 1w + Staging→Prod 1w) holds **only if extraction
work starts in Week 1**, not Week 2.

| Work item | AI helps? | Real duration | Why |
|---|---|---|---|
| Frontend changes | High | 0.5w — holds | UI scaffolding and styling are the strongest AI-assisted areas |
| Backend: schema, APIs, auth, roles, billing | High | 1w — can beat estimate | Standard CRUD and integration patterns generate fast |
| IBA PDF template engine | High | 2–3 days | Template generates well; formatting review is manual |
| AI extraction accuracy tuning | Low | 1w minimum, cannot compress | Iteration-bound, not code-bound. 70% → 90% on real Telugu/Kannada scans is measurement cycles |
| Portal verification integrations | Partial | 3–5 days, external risk | Gated by portal uptime and rate limits |
| Functional QA | Partial | 1w — holds | AI generates test cases; execution is human |
| Security + cloud security review | Low | 3–4 days | Access control, encryption, PII need a real pass |
| Usage analytics instrumentation | High | 2 days | Event schema + wiring generate fast |
| Staging → Prod | Low | 1w — holds | Infra, DNS, secrets, backups, rollback — no shortcut |

## Post-launch sprints

| Sprint | Dates | Focus |
|---|---|---|
| S1 | Fri 25 Sep – Thu 1 Oct | Launch defects, onboarding friction |
| S2 | Fri 2 – Thu 8 Oct | Extraction accuracy on real user documents |
| S3 | Fri 9 – Thu 15 Oct | Retention blockers from analytics |
| S4 | Fri 16 – Thu 22 Oct | Conversion blockers (free → paid) |
| S5 | Fri 23 – Thu 29 Oct | Performance + cost per report |
| S6 | Fri 30 Oct – Thu 5 Nov | Stabilise, close MVP, V2 backlog handover |

Cadence: Friday sprint planning · daily 15-min standup · Thursday demo + metrics review + retro.
All work through tickets. Ticket updates discussed in calls, not chat.

## Quantitative tracking

| Metric | Target | Checkpoint |
|---|---|---|
| Documents labelled for extraction training | 50+ | Thu 20 Aug |
| Extraction accuracy — baseline recorded | — | Thu 20 Aug |
| Extraction accuracy — key fields | ≥ 90% | Thu 10 Sep |
| FE changes complete | 100% | Tue 25 Aug |
| Backend feature complete | 100% | Thu 10 Sep |
| Open P0 / P1 defects | 0 | Thu 17 Sep |
| Time to produce one report | ≤ 30 min | Thu 17 Sep |
| PDF generation time | < 30 sec | Thu 17 Sep |
| Page load P95 | < 3 sec | Thu 17 Sep |
| AI + infra cost per report | < ₹40 | Thu 17 Sep |
| Security review findings closed | 100% critical | Thu 17 Sep |
| Production smoke test pass | 100% | Tue 22 Sep |
| Launch-ready leads | ≥ 5 | Thu 17 Sep |
| LinkedIn posts published | 12+ | Thu 24 Sep |
| Blogs + newsletters | 4+ | Thu 24 Sep |
| WhatsApp group members | 50+ | Thu 24 Sep |
| Downloadable resource captures | 25+ | Thu 24 Sep |
| Tickets updated on time | ≥ 90% | Weekly |

## Qualitative tracking

| Signal | Captured from | Healthy looks like |
|---|---|---|
| Trust in AI extraction | Valuer feedback | "I only correct 2–3 fields" |
| Willingness to sign the report | Valuer behaviour | No hesitation, no Excel fallback |
| Report credibility | Bank contact feedback | Accepted without reformatting |
| Onboarding clarity | First-session observation | First report unaided |
| Willingness to pay | Sales calls | Asks about plans before being pitched |
| Content resonance | LinkedIn/WhatsApp replies | Valuers reply with their own problems |
| Team clarity | Weekly review | Blockers raised early in the week, not at the review |
`;

const ENGINEERING = `
Owner: Sandeep. Architecture, AI/ML, app build, QA and platform all report in.
Tracks on the board: \`platform\` (ARC-*), \`ai-ml\` (AIE-*), \`app\` (FS-*), \`qa\` (QA-*), \`maintenance\` (MNT-*).

## Week by week

- **W1** — Prototype audit (works / stubbed / broken). **Critical path:** assemble 50+ real property documents and label ground-truth fields. Extraction baseline run, per-field accuracy recorded. Architecture decisions + ticket breakdown. *Exit Thu 20 Aug: tickets created, corpus in hand.*
- **W2** — All frontend changes (0.5w) from the PRD. Backend start: schema, auth, roles, plan limits. Extraction tuning iteration 1 vs. baseline. *Exit Thu 27 Aug: FE complete, BE underway.*
- **W3** — Backend core: case creation, document upload, extraction pipeline, valuer review/edit, valuation workings, IBA PDF generation. Portal verification + manual fallback. Tuning iteration 2 → 85%. *Exit Thu 3 Sep: core report path demoable end-to-end.*
- **W4** — Mobile site visit (geotag, GPS, offline tolerance), team assignment, billing + usage counters, analytics instrumentation. Tuning iteration 3 → 90%. *Exit Thu 10 Sep: feature freeze, zero unstarted tickets.*
- **W5 — QA week** — Functional QA across all 8 workflow steps, cross-browser + Android/iOS, edge cases, data isolation. Non-functional: analytics verification, data security, cloud security, performance, cost per report. Daily triage, P0/P1 fixed same day. *Exit Thu 17 Sep: zero open P0/P1, security pass complete.*
- **W6** — Staging → Production, DNS, secrets, monitoring, alerting. Production smoke test on all 8 steps + rollback drill. Go / No-Go (tech). *Thu 24 Sep: MVP launch.*

## Accountability

| Role | Person | Accountable for |
|---|---|---|
| Engineering lead / PM | Sandeep | Launch on 24 Sep and the 4-week envelope holding |
| Architect & Infra | Harshith | The system standing up under real load without a data-isolation incident |
| AI Engineers | Raunak & Gopal Vasistha | 90% extraction accuracy on real documents by 10 Sep — the single task most likely to move the launch date |
| QA | Aparna | Zero P0/P1 escaping into production |

## The 8 workflow steps

Case creation → extraction → cross-verification → valuer review → portal verification →
site visit → workings → report signing. Every QA pass walks all eight.
`;

const PRODUCT = `
Owner: Jay (non-tech prioritisation). Accountable for scope discipline and the PRD not moving
after the 20 Aug freeze.

## Week by week

- **W1** — PRD v1 (functionality + UX/UI enhancements). Logo brief + 3 tagline options. Hyper-focused target user: narrow to **one** primary segment (e.g. solo registered valuers in Telangana doing bank-panel work). PRD v2 signed, scope frozen. *Exit Thu 20 Aug.*
- **W2** — UX/UI review against the PRD checklist as frontend lands. Usage feedback loop defined — which events show a valuer is stuck.
- **W3** — Scope hold. Any new ask → post-launch backlog. No exceptions.
- **W4** — Acceptance criteria signed per feature. Functional vs. non-functional QA scope agreed with QA. *Exit Thu 10 Sep.*
- **W5** — QA oversight: confirm test cases were written in W4, not invented mid-week.
- **W6** — Go / No-Go (non-tech side): 5 leads, onboarding, support, content.

## Scope control

The freeze is the product function's main instrument. After PRD v2 on 20 Aug, every new ask —
technical or not — is logged and routed to the post-launch backlog by Jay with Sandeep. Nothing
enters the build silently. Post-launch, those items become the S1–S6 input.
`;

const MARKETING = `
Functions: Content · Social Media · Market Research · Performance Analytics. Owner: Shravani.
Goal: ≥ 5 leads ready to use before launch (shared with Sales).

## Week by week

- **W1 — Compile** — All existing content into one library. Collect/record videos. Draft 4+ blogs and newsletters. Draft downloadables (checklist, IBA format guide, rate card). Map bank-side IBA format acceptance. Competitor scan.
- **W2 — Go live** — Content → LinkedIn posts, scheduled. Company + founder profiles enhanced. Blog 1 + newsletter 1. Instagram trailer + Q&A for surveyors. HeyGen trial. LinkedIn automation raised as a ticket — **do not wait on it, schedule manually**. Pricing validation vs. observed willingness to pay.
- **W3** — Blog 2 + newsletter 2. WhatsApp group created + seeding strategy live. Engagement content. Webinar/podcast outreach. Identify a partner valuer to co-promote.
- **W4** — Downloadables published and gated for lead capture. Webinar/podcast recorded. Launch-week content drafted.
- **W5** — Launch sequence queued and scheduled. Channel-level assessment: which channel produced actual leads.
- **W6** — Launch sequence fires: LinkedIn, Instagram, newsletter, WhatsApp.

## Targets

| Metric | Target | Checkpoint |
|---|---|---|
| Content library compiled | Done | Thu 20 Aug |
| LinkedIn posts published | 12+ | Thu 24 Sep |
| Blogs + newsletters | 4+ | Thu 24 Sep |
| WhatsApp group members | 50+ | Thu 24 Sep |
| Downloadable resource captures | 25+ | Thu 24 Sep |
| Leads sourced for Sales (shared) | ≥ 5 | Thu 17 Sep |

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Waiting on LinkedIn automation | Campaign delayed | Manual scheduling from W2; automation is an enhancement |
| WhatsApp group seeded too late | Weak launch-day engagement | Group creation starts W3, not W5 |
| Content compiled but not distinct per channel | Low engagement | Content hands off format-specific pieces, not raw drafts |
`;

const SALES = `
Functions: Lead Discovery · Follow-Up · Conversions. Owner: Shravani.
Goal: ≥ 5 leads ready to use before launch. **One tracker only — no parallel systems.**

## Week by week

- **W1** — Build the lead list: 40–50 valuers across TG/AP/KA. Enrich and dedupe. Decide the tracker. *Exit Thu 20 Aug: list ready.*
- **W2** — Product training on all 8 workflow steps. Call script + objection handling. First calls begin Tue 25 Aug. Follow-up cadence defined: call → WhatsApp → demo.
- **W3** — Active calling, every touch logged. Qualify toward 5 launch-ready leads. Target 25+ contacted.
- **W4** — Demos running. Pipeline reviewed against the 5-lead goal.
- **W5** — **5 launch-ready leads confirmed in writing** (Thu 17 Sep) — one of the four items that can move the launch date.
- **W6** — 5 leads onboarded live at launch.

## Targets

| Metric | Target | Checkpoint |
|---|---|---|
| Lead list built | 40–50 | Thu 20 Aug |
| Valuers contacted | 25+ | Thu 3 Sep |
| Launch-ready leads confirmed | ≥ 5 | Thu 17 Sep |
| Leads onboarded at launch | 5 | Thu 24 Sep |

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Ramp is slow | 5-lead goal missed | Lead list ready before calling starts; 2-day training, calls by W2 |
| Leads don't match Product's target segment | Weak onboarding, poor retention signal | Align lead criteria with Jay's hyper-focused segment before calling |
| Tracker fragmentation | Lost follow-ups | One system decided by Thu 20 Aug, no exceptions |
`;

const ACCOUNT = `
Functions: Client Experience · Presentations. Prep from W4, active from launch.
Depends on Sales delivering 5 confirmed leads by Thu 17 Sep.
Accountable for: the 5 launch leads each completing a real report without churning in week one.

## Week by week

- **W4** — Onboarding flow designed for the 5 launch leads.
- **W5** — Client presentation deck ready. Support playbook: top 10 expected issues with answers.
- **W6** — Onboard all 5 launch leads personally at launch.
- **Post-launch** — Ensure each lead completes their first real report in launch week. Weekly check-in call per client, capturing qualitative feedback. Report client sentiment to Jay weekly: trust, friction, willingness to pay.

## Targets

| Metric | Target | Checkpoint |
|---|---|---|
| Onboarding flow ready | Yes | Thu 10 Sep |
| Leads onboarded personally | 5 of 5 | Thu 24 Sep |
| Leads completing first real report | 5 of 5 | Week of Fri 25 Sep |
| Weekly check-ins held | 100% | Weekly to Thu 5 Nov |

## Risk

Leads onboard but don't complete a first report in week one — a false sense of a successful
launch. Track **"first report completed"**, not just "onboarded", from day one.
`;

const MAINTENANCE = `
Active from launch Thu 24 Sep. Depends on Architect + QA handing off monitoring and alerting
by Thu 17 Sep. Accountable for catching and escalating production issues before clients or
Account Management do.

## Scope

- **W5 (pre-launch setup)** — Monitoring + alerting configured with the Architect. Support queue and SLA defined. P0 escalation path into engineering documented **with names, not roles**.
- **From launch** — Uptime monitoring, daily backup verification. Incident response, first-line support triage. Weekly report to Sandeep: uptime, incident count, mean time to resolve.

## Targets

| Metric | Target | Checkpoint |
|---|---|---|
| Monitoring + alerting live | Yes | Thu 17 Sep |
| SLA defined | Yes | Thu 17 Sep |
| Uptime | ≥ 99.5% | Weekly from launch |
| P0 mean time to resolve | < 4 hours | Weekly from launch |
| Backup verification | Daily, 100% | From launch |

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Monitoring set up after launch, not before | Blind first week in production | Hard dependency: live by Thu 17 Sep, verified in QA week |
| No named escalation owner | P0s sit unresolved | Escalation path documented with names by Thu 17 Sep |
`;

const POST_MVP = `
From the Roadmap Diagram. Everything here is **after** the MVP hard stop on Thu 5 Nov 2026 —
none of it is scheduled, and none of it counts against the launch burndown.

## The MVP box (what launches on 24 Sep)

| Area | Scope |
|---|---|
| Product | Single valuator · same person site visit · free membership (5 cases) · basic Android usage · multilingual interface · document photo/camera upload |
| Domain | Residential L&B · 9 deed types · focus on 3 states |
| AI | Basic OCR extraction · basic report generation · basic risk flagging · multilingual AI support · AI ground-truth documentation |
| Engineering | DPDP · stable infra · data security · authentication · scalability · payment security · CI/CD · optimised engineering costs |
| Sales & Marketing | Initial outreach · content creation and planning · domain expert validation |

## Feature expansion

| Version | Scope |
|---|---|
| V1 | Teams · assign members · Android/iPhone app support + offline |
| V2 | Mark accepted/rejected by bank · reopen and update a rejected report · live report update as facilities or risks change · live update against changing government rules and regulations · fraud detection · chatbot |
| V3 | Marketplace connecting banks, valuators and surveyors · track payments with banks |
| V4 | WhatsApp Business chat |

## AI roadmap

| Stage | Scope |
|---|---|
| 1 | OCR accuracy · report format/style consistency |
| 2 | Flagging and compliance checks · AI insights within the report |
| 3 | Browser automation · government websites · sales comparables |
| 4 | Closest historic case match via vector database · image analysis of site photos and value estimation |
| 5 (end state) | Fully AI automated · aggregated obfuscated analytics · domain-level recommendations (where to buy land, where to place machinery, is the location good) |
| 6 | Cross historic report consistency and insights · fraud detection |

Note: the diagram flows 1 → 2 → 3 → 4 → 6 → 5, with Stage 5 as the end state. The numbering
should be corrected to match the sequence.

## Domain expansion

Commercial → Agricultural + Industrial → Plant & Machinery → Financial Assets (TEV/LIE).

## Channel expansion

| Channel | Target |
|---|---|
| 1 | Independent valuators · known bank managers |
| 2 (L&B) | Awareness via social media · cold calling the IBBI list |
| 2 (Plant & Machinery) | Manufacturing industries · medical |
| 3 | NBFCs, HFCs, banks |
`;

const DOCS: [string, string, string][] = [
  ["Overview", "🧭", OVERVIEW],
  ["MVP Launch Plan", "🗓️", MASTER],
  ["Engineering Track", "⚙️", ENGINEERING],
  ["Product Track", "🧪", PRODUCT],
  ["Marketing Track", "📣", MARKETING],
  ["Sales Track", "📈", SALES],
  ["Account Management Track", "🎧", ACCOUNT],
  ["Maintenance Track", "🛠️", MAINTENANCE],
  ["Post-MVP Roadmap", "🗺️", POST_MVP],
];

async function main() {
  const [project] = await db.select().from(projects).where(eq(projects.key, "VAL"));
  if (!project) throw new Error("Valytica project not found");
  const [sandeep] = await db.select().from(users).where(eq(users.email, "sandeep@gnanalytica.com"));

  // Replace any prior load of these titles.
  const prior = await db.select().from(pages).where(eq(pages.projectId, project.id));
  const titles = new Set(DOCS.map(([t]) => t));
  const stale = prior.filter((p) => titles.has(p.title)).map((p) => p.id);
  for (const id of stale) await db.delete(pages).where(eq(pages.id, id));

  let overviewId: string | null = null;
  for (const [i, [title, icon, md]] of DOCS.entries()) {
    const content = markdownToDoc(md.trim());
    const inserted: { id: string }[] = await db
      .insert(pages)
      .values({
        workspaceId: project.workspaceId,
        projectId: project.id,
        parentId: i === 0 ? null : overviewId,
        title,
        icon,
        content,
        contentText: docToText(content),
        position: `a${String(i).padStart(3, "0")}`,
        creatorId: sandeep?.id ?? null,
      })
      .returning({ id: pages.id });
    if (i === 0) overviewId = inserted[0].id;
    const tables = (md.match(/^\|\s*---/gm) ?? []).length;
    console.log(`  ${icon} ${title.padEnd(26)} ${tables} tables`);
  }
  console.log(`\n${DOCS.length} pages under Valytica → Overview.`);
  void and; void isNull;
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
