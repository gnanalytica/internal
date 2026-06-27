import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq, max } from "drizzle-orm";

import { db, schema } from "./index";

/**
 * Seed the Standup-AI product roadmap (autonomous standup bot: Recall.ai +
 * Gemini/Claude + graph + Slack/Linear) into the hub — initiative, cycles, the
 * phased Feature roadmap (completed Dec 2025 → Jun 2026 + future) and tickets,
 * grounded in the real Standup-AI codebase but stretched over 7 months. People
 * assumed present (db:seed-valytica). Idempotent. Run: npm run db:seed-standup
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
    title: "Foundation — POC & Infrastructure",
    desc: "Standalone transcription → Gemini summary → graphify corpus, a FastAPI skeleton, S3 storage, and AWS infra (EC2/ALB/ACM/Route 53) with GitHub Actions CI.",
    status: "shipped",
    start: "2025-12-01",
    target: "2025-12-20",
    owner: "sandeep",
    tickets: [
      ["Local ffmpeg capture + Google STT pipeline", "sanjana"],
      ["FastAPI skeleton + /standup/process endpoint", "harshith"],
      ["Gemini 2.5 Flash chunk extraction", "sanjana"],
      ["Storage abstraction (S3 vs local) + prefix layout", "harshith"],
      ["Graphify CLI wrapper + corpus markdown accumulation", "sanjana"],
      ["Terraform IaC: VPC, ALB, EC2, CloudFront, Route 53", "harshith"],
      ["GitHub Actions CI (lint/test/build) + deploy.sh", "harshith"],
      ["Health check endpoint + config validation", "harshith"],
    ],
  },
  {
    title: "Recall Bot & Live Meeting Capture",
    desc: "Dispatch a Recall.ai bot into Google Meet → HMAC-verified transcript webhooks → 30s chunk flush → Gemini delta extraction → action-item proposals → Slack digest.",
    status: "shipped",
    start: "2025-12-20",
    target: "2026-01-22",
    owner: "sanjana",
    tickets: [
      ["Recall.ai client + /standup/start (spawn bot, store session)", "sanjana"],
      ["/recall/webhook HMAC-verified event ingestion", "harshith"],
      ["Per-bot utterance ring buffer + 30s chunk flush timer", "harshith"],
      ["Gemini delta extraction (new entities, edges, action items)", "sanjana"],
      ["Live graph accumulation + S3 latest.json updates", "sanjana"],
      ["Meeting finalization on bot.done + transcript reassembly", "harshith"],
      ["Slack Block Kit formatter + webhook poster", "raunak"],
      ["Restart-safe finalize (locking)", "harshith"],
    ],
  },
  {
    title: "Identity Registry & Canonicalization",
    desc: "A single source of truth for person identities (team.yaml) resolving aliases and mis-hearings into stable entity IDs across live + corpus graphs and Linear routing.",
    status: "shipped",
    start: "2026-01-22",
    target: "2026-02-10",
    owner: "sanjana",
    tickets: [
      ["team.yaml v2 schema (id, display_name, emails, aliases)", "sanjana"],
      ["IdentityService loader + email-based lookup", "harshith"],
      ["Alias resolution (Gnanalytica ↔ Sandeep, mis-hearings)", "sanjana"],
      ["Corpus + live graph dedup via identity registry", "sanjana"],
      ["Slack participant list reconciliation", "raunak"],
      ["Resolve identity aliases at chat query time", "sanjana"],
      ["Multi-tenant identity scoping prep", "harshith"],
    ],
  },
  {
    title: "Graph Architecture & Chat Routing",
    desc: "Three coexisting graphs (live, corpus, unified) and a 4-tier chatbot router (cache → regex → Gemini prose → Gemini full → Sonnet+tools) with prompt caching.",
    status: "shipped",
    start: "2026-02-10",
    target: "2026-03-06",
    owner: "sandeep",
    tickets: [
      ["GraphEntity/GraphRelationship/GraphSnapshot models", "sanjana"],
      ["Live graph wipe at standup start + corpus rebuild", "sanjana"],
      ["Unified graph merge (corpus primary, live overlay)", "sanjana"],
      ["4-tier chat router (regex → Gemini → Sonnet+tools)", "sanjana"],
      ["Response cache (TTL, keyed on question+scope+fingerprint)", "harshith"],
      ["Anthropic prompt caching (ephemeral, cost drop)", "sanjana"],
      ["Gemini-only corpus pipeline (alt to Sonnet+graphify)", "shraddha"],
      ["Community detection + suggested questions", "sanjana"],
    ],
  },
  {
    title: "Dashboard Tabs & Web UI",
    desc: "A React SPA — Today, Live, Meet, Tickets, History, Knowledge Graph, Corpus, Gemini Lab and Settings tabs, with SSE chat and force-graph visualizations.",
    status: "shipped",
    start: "2026-03-06",
    target: "2026-03-30",
    owner: "raunak",
    tickets: [
      ["React + Vite + Tailwind scaffold + tab shell", "raunak"],
      ["Today tab (participants, blockers, decisions, action items)", "raunak"],
      ["Live tab (streaming cards, live graph, bot status)", "raunak"],
      ["Meet tab (ad-hoc bot dispatch via Meet URL)", "raunak"],
      ["Knowledge Graph tab (communities, god-nodes, bus-factor)", "raunak"],
      ["Corpus tab (PDF/MD/PPTX upload + registry)", "raunak"],
      ["Chat panel: SSE streaming + follow-ups + suggestions", "raunak"],
      ["Settings tab (Slack verbosity/persona/sections)", "raunak"],
    ],
  },
  {
    title: "Scheduled Standups & Cron Hardening",
    desc: "Cron-driven daily 08:55 dispatch → bot join → 30s extractions → 09:30 finalize → Slack digest → nightly corpus rebuild, with finalization locking to prevent duplicate finalizes.",
    status: "shipped",
    start: "2026-03-30",
    target: "2026-04-20",
    owner: "harshith",
    tickets: [
      ["cron.d standup job lines (dispatch/finalize/rebuild)", "harshith"],
      ["Cron /standup/start with source=cron tag", "harshith"],
      ["Finalization locking (atomic S3 write)", "harshith"],
      ["Meeting-duration override + final chunk flush", "sanjana"],
      ["Canonical summary slot (first finalize wins)", "harshith"],
      ["Slack digest post + finalize-failure alerting", "raunak"],
      ["Reliability hardening so Monday runs unattended", "sairam"],
      ["EC2 user_data cron setup (Terraform templating)", "harshith"],
    ],
  },
  {
    title: "Action Items Queue & Linear Sync",
    desc: "Gemini proposes action items during the meeting → a human-reviewed Tickets queue → Confirm creates a Linear ticket; Ignore/Delete/Bulk with a replay-proof inbound webhook.",
    status: "shipped",
    start: "2026-04-15",
    target: "2026-05-08",
    owner: "raunak",
    tickets: [
      ["ActionItem model + status (pending/approved/ignored/deleted)", "harshith"],
      ["/action-items list/edit/approve/ignore/delete + bulk", "raunak"],
      ["Linear GraphQL client + ticket creation", "harshith"],
      ["Linear OAuth + workspace-scoped team routing", "harshith"],
      ["Owner → Linear member mapping (UNASSIGNED, never Unknown)", "sanjana"],
      ["Replay-proof inbound webhook (freshness + nonce)", "pranav"],
      ["Tickets review queue UI (Confirm/Ignore/Delete/Bulk)", "raunak"],
      ["Audit log (who approved what, from which standup)", "harshith"],
    ],
  },
  {
    title: "Chatbot & Agents",
    desc: "The chat panel plus an Agents tab with multi-agent skills (blocker summary, email draft, dashboard, bug-fix PR, HTML prototype, weekly digest, PDF/PPTX rendering) and streaming handoff.",
    status: "shipped",
    start: "2026-05-01",
    target: "2026-05-26",
    owner: "sanjana",
    tickets: [
      ["Chat SSE endpoint + session history", "sanjana"],
      ["Tier-3 Sonnet + tools (search_entities, transcript, counterfactual)", "sanjana"],
      ["Skill registry + base class", "sanjana"],
      ["Blocker-summary + email-draft skills", "sanjana"],
      ["Bug-fix PR skill (map blockers → repo context)", "raunak"],
      ["PDF/PPTX rendering skills + artifact blobs", "raunak"],
      ["Parallel fan-out + structured handoff", "sanjana"],
      ["Agent token metering + streaming patches", "harshith"],
    ],
  },
  {
    title: "Multi-Tenant, Auth, RBAC & Compliance",
    desc: "Self-serve signup → workspaces → invites → role-based access, private meetings behind login, enterprise SSO (OIDC), MFA (TOTP), SCIM 2.0, scheduled purge and audit logging.",
    status: "shipped",
    start: "2026-05-20",
    target: "2026-06-13",
    owner: "harshith",
    tickets: [
      ["User/Workspace/Member/Role models + signup/login/invite", "harshith"],
      ["Gate private meetings behind shared login", "pranav"],
      ["Enterprise SSO (OIDC) + MFA (TOTP)", "pranav"],
      ["SCIM 2.0 user sync (Okta/Azure)", "harshith"],
      ["Owner-only dashboard + scoped /standup/today/mine", "raunak"],
      ["Cross-tenant isolation middleware", "harshith"],
      ["Owner hard-delete + scheduled account purge", "harshith"],
      ["Compliance posture + audit log of write actions", "manjusha"],
    ],
  },
  {
    title: "Integrations & Connectors",
    desc: "OAuth connectors with bi-directional sync — GitHub, Jira, Notion, Confluence, HubSpot, Salesforce — plus connected-state UX, a free-tier cap and per-tenant transcription preferences.",
    status: "building",
    start: "2026-06-05",
    target: "2026-06-30",
    owner: "harshith",
    tickets: [
      ["Integration registry (workspace-scoped OAuth tokens)", "harshith", "done"],
      ["GitHub OAuth + issue/PR ↔ blocker sync", "raunak", "done"],
      ["Jira OAuth + bi-directional ticket sync", "harshith", "done"],
      ["Notion/Confluence doc → corpus embed", "sanjana", "in_progress"],
      ["HubSpot/Salesforce OAuth + context mapping", "raunak", "in_progress"],
      ["Per-tenant transcription preference (provider/language)", "sanjana", "in_review"],
      ["Connected-state UX + free-tier integration cap", "raunak", "todo"],
      ["Webhook signature verification per integration", "pranav", "todo"],
    ],
  },
  // ---- future ----
  {
    title: "Hierarchical Graphs & Membrane Access",
    desc: "A single unified corpus graph with layer-based visibility (engineering/management/client/executive/public); information flows down via promotion only, filtered by requester role before the LLM sees it.",
    status: "planned",
    start: "2026-07-01",
    target: "2026-08-29",
    owner: "sandeep",
    tickets: [
      ["Add layer field to entities/edges (backward-compatible)", "sanjana"],
      ["LayerType enum + role → visible_layers mapping", "sanjana"],
      ["Multi-meeting config (replace single Meet URL)", "harshith"],
      ["Graph filtering by requester role across chat tiers", "sanjana"],
      ["/graph/promote (manager promotes entity to a layer)", "sanjana"],
      ["RBAC audit log for cross-layer visibility", "pranav"],
    ],
  },
  {
    title: "Embeddings, Vector Search & RAG",
    desc: "Embed graph nodes/edges into a vector store for semantic retrieval, RAG-augmented chat, and cross-meeting pattern discovery.",
    status: "planned",
    start: "2026-08-15",
    target: "2026-10-17",
    owner: "sanjana",
    tickets: [
      ["Embedding model + vector store (pgvector/Pinecone)", "sanjana"],
      ["Async embedding pipeline (batch + stream) + cache", "harshith"],
      ["Semantic search endpoint (top-K similar entities)", "sanjana"],
      ["RAG-augment chat tiers with vector results", "sanjana"],
      ["Cross-meeting pattern + anomaly detection", "shraddha"],
      ["Embedding cost monitoring", "harshith"],
    ],
  },
  {
    title: "Multi-Meeting & Advanced Analytics",
    desc: "Dispatch multiple meeting series daily (standup, management sync, client weekly, 1:1s), a conflict radar, owner-load HUD, meeting-ROI metrics and stale-item detection.",
    status: "idea",
    start: "2026-10-01",
    target: "2026-12-19",
    owner: "jay",
    tickets: [
      ["Multi-meeting cron config (per series, layer-tagged)", "harshith"],
      ["Conflict radar (attendee double-booking + reschedule)", "raunak"],
      ["Owner-load HUD + burndown trend", "sanjana"],
      ["Meeting-ROI metric (items done / attendees / duration)", "sanjana"],
      ["Stale action-item detection (>14 days open)", "raunak"],
      ["Weekly digest skill + pre-meeting brief", "sanjana"],
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
    .where(and(eq(schema.projects.workspaceId, ws.id), eq(schema.projects.name, "Standup-AI")))
    .limit(1);
  if (!project) return console.log("No 'Standup-AI' project found.");

  const users = await db.select({ id: schema.users.id, email: schema.users.email }).from(schema.users);
  const userByEmail = new Map(users.map((u) => [u.email, u.id]));
  const uid = (k: string) => userByEmail.get(KEY[k]) ?? null;
  const creatorId = uid("sandeep");

  let [initiative] = await db
    .select({ id: schema.initiatives.id })
    .from(schema.initiatives)
    .where(and(eq(schema.initiatives.workspaceId, ws.id), eq(schema.initiatives.name, "Standup-AI")))
    .limit(1);
  if (!initiative) {
    [initiative] = await db
      .insert(schema.initiatives)
      .values({ workspaceId: ws.id, name: "Standup-AI", color: "#3b82f6" })
      .returning({ id: schema.initiatives.id });
  }
  await db.update(schema.projects).set({ initiativeId: initiative.id }).where(eq(schema.projects.id, project.id));

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
  console.log(`Standup-AI roadmap seeded: ${featureCount} phases, ${issueCount} tickets.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
