#!/usr/bin/env node
// MCP server for the Internal workspace. Wraps the REST API (/api/v1) as tools
// so any MCP client (Claude Code, Claude Desktop, Cursor, agents) can drive the
// workspace. Configure via env:
//   INTERNAL_API_URL   base API URL (default https://internal.gnanalytica.com/api/v1)
//   INTERNAL_API_KEY   a workspace API key (Settings → API & MCP)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_URL = (
  process.env.INTERNAL_API_URL || "https://internal.gnanalytica.com/api/v1"
).replace(/\/$/, "");
const API_KEY = process.env.INTERNAL_API_KEY || "";

async function api(path, { method = "GET", body } = {}) {
  if (!API_KEY) throw new Error("INTERNAL_API_KEY is not set.");
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await res.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = raw;
  }
  if (!res.ok) {
    const msg = typeof data === "object" ? JSON.stringify(data) : String(data);
    throw new Error(`API ${res.status}: ${msg}`);
  }
  return data;
}

function result(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

const server = new McpServer({ name: "internal", version: "2.0.0" });

const tool = (name, description, shape, handler) =>
  server.tool(name, description, shape, async (args) => {
    try {
      return result(await handler(args ?? {}));
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: err?.message ?? String(err) }],
      };
    }
  });

/** Departments a task can belong to — mirrors ISSUE_TYPES in the app. */
const ISSUE_TYPES = [
  "engineering",
  "product",
  "research",
  "marketing",
  "sales",
  "ops",
  "legal",
  "finance",
  "people",
  "admin",
];

/** Build a `?a=b` query string from the args the caller actually passed. */
const query = (args, keys) => {
  const q = new URLSearchParams();
  for (const k of keys) if (args[k] != null) q.set(k, String(args[k]));
  const s = q.toString();
  return s ? `?${s}` : "";
};

// ---- Workspace ----
tool(
  "whoami",
  "Get the workspace, the member this API key acts as, and the key's name. Call this first to confirm which workspace you are about to change.",
  {},
  () => api("/me"),
);

tool(
  "list_users",
  "List workspace members with their ids, emails and roles. Use this to resolve a person's name to the `assigneeId` / `ownerId` that other tools expect.",
  {},
  () => api("/users"),
);

// ---- Issues ----
tool(
  "list_issues",
  "List tasks. Filter by status, project id, assignee id, department `type`, cycle id or milestone id. E.g. type=marketing lists the marketing team's tasks.",
  {
    status: z.string().optional(),
    project: z.string().optional(),
    assignee: z.string().optional(),
    type: z.enum(ISSUE_TYPES).optional(),
    cycle: z.string().optional(),
    milestone: z.string().optional(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  (a) =>
    api(
      `/issues${query(a, ["status", "project", "assignee", "type", "cycle", "milestone", "limit"])}`,
    ),
);

tool("get_issue", "Get a single issue by id.", { id: z.string() }, (a) =>
  api(`/issues/${a.id}`),
);

tool(
  "create_issue",
  "Create a task in any department. `type` is the department the work belongs to (default engineering) — a task is not only engineering. Status: backlog|todo|in_progress|in_review|done|canceled. Priority: urgent|high|medium|low|none. Dates are ISO (YYYY-MM-DD). `description` is Markdown. Resolve people with list_users and labels with list_labels.",
  {
    title: z.string(),
    type: z.enum(ISSUE_TYPES).optional(),
    projectId: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    assigneeId: z.string().optional(),
    cycleId: z.string().optional(),
    milestoneId: z.string().optional(),
    featureId: z.string().optional(),
    parentId: z.string().optional(),
    labelIds: z.array(z.string()).optional(),
    estimate: z.number().optional(),
    startDate: z.string().optional(),
    dueDate: z.string().optional(),
    description: z.string().optional(),
  },
  (a) => api("/issues", { method: "POST", body: a }),
);

tool(
  "update_issue",
  "Update a task: reassign it, move it between departments (`type`), reschedule it, or attach it to a cycle, milestone, feature or parent task. Pass only the fields to change; pass null to clear one. `labelIds` replaces the whole label set.",
  {
    id: z.string(),
    title: z.string().optional(),
    type: z.enum(ISSUE_TYPES).optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    assigneeId: z.string().nullable().optional(),
    projectId: z.string().nullable().optional(),
    cycleId: z.string().nullable().optional(),
    milestoneId: z.string().nullable().optional(),
    featureId: z.string().nullable().optional(),
    parentId: z.string().nullable().optional(),
    labelIds: z.array(z.string()).optional(),
    estimate: z.number().nullable().optional(),
    startDate: z.string().nullable().optional(),
    dueDate: z.string().nullable().optional(),
    description: z.string().optional(),
  },
  ({ id, ...patch }) => api(`/issues/${id}`, { method: "PATCH", body: patch }),
);

tool(
  "delete_issue",
  "Permanently delete an issue by id. This cannot be undone.",
  { id: z.string() },
  (a) => api(`/issues/${a.id}`, { method: "DELETE" }),
);

tool(
  "comment_on_issue",
  "Add a comment to an issue.",
  { id: z.string(), body: z.string() },
  (a) => api(`/issues/${a.id}/comments`, { method: "POST", body: { body: a.body } }),
);

// ---- Docs (pages) ----
tool("list_pages", "List doc pages (excludes trashed pages).", {}, () =>
  api("/pages"),
);

tool(
  "get_page",
  "Get a page by id. Returns the body as Markdown plus the raw editor JSON.",
  { id: z.string() },
  (a) => api(`/pages/${a.id}`),
);

tool(
  "create_page",
  "Create a doc page. `content` is Markdown — headings, lists, task lists, code fences, quotes and inline formatting are all preserved in the editor. Pass `parentId` to nest under a page, or `projectId` to file it under a project's Docs.",
  {
    title: z.string(),
    content: z.string().optional(),
    icon: z.string().optional(),
    parentId: z.string().optional(),
    projectId: z.string().optional(),
  },
  (a) => api("/pages", { method: "POST", body: a }),
);

tool(
  "update_page",
  "Update a page's title, icon, or body. `content` is Markdown and REPLACES the whole body — call get_page first and send back the full edited document, not just the changed part.",
  {
    id: z.string(),
    title: z.string().optional(),
    icon: z.string().optional(),
    content: z.string().optional(),
  },
  ({ id, ...patch }) => api(`/pages/${id}`, { method: "PATCH", body: patch }),
);

tool(
  "delete_page",
  "Move a page and its sub-pages to the trash. Recoverable from /trash in the app.",
  { id: z.string() },
  (a) => api(`/pages/${a.id}`, { method: "DELETE" }),
);

// ---- Planning ----
tool("list_projects", "List projects.", {}, () => api("/projects"));

tool(
  "create_project",
  "Create a project (the key prefix is derived if omitted).",
  {
    name: z.string(),
    key: z.string().optional(),
    description: z.string().optional(),
  },
  (a) => api("/projects", { method: "POST", body: a }),
);

tool("list_cycles", "List cycles (sprints).", {}, () => api("/cycles"));

tool(
  "create_cycle",
  "Create a cycle (sprint) for a project. Dates are ISO (YYYY-MM-DD).",
  {
    name: z.string(),
    projectId: z.string(),
    startDate: z.string(),
    endDate: z.string(),
  },
  (a) => api("/cycles", { method: "POST", body: a }),
);

tool(
  "list_milestones",
  "List a project's milestones (release phases) with roll-up progress. Requires a project id.",
  { project: z.string() },
  (a) => api(`/milestones${query(a, ["project"])}`),
);

tool(
  "create_milestone",
  "Create a milestone (a dated phase within a project). Status: planned|on_track|at_risk|off_track|achieved|missed.",
  {
    name: z.string(),
    projectId: z.string(),
    description: z.string().optional(),
    targetDate: z.string().optional(),
    status: z.string().optional(),
  },
  (a) => api("/milestones", { method: "POST", body: a }),
);

tool(
  "list_features",
  "List features (the product unit above tasks), optionally by project id.",
  { project: z.string().optional() },
  (a) => api(`/features${query(a, ["project"])}`),
);

tool(
  "create_feature",
  "Create a feature under a project, optionally attached to a milestone. Status: idea|planned|building|shipped|archived.",
  {
    title: z.string(),
    projectId: z.string().optional(),
    milestoneId: z.string().optional(),
    status: z.string().optional(),
    startDate: z.string().optional(),
    targetDate: z.string().optional(),
    ownerId: z.string().optional(),
  },
  (a) => api("/features", { method: "POST", body: a }),
);

tool("list_labels", "List labels, for use as `labelIds` on tasks.", {}, () =>
  api("/labels"),
);

tool(
  "create_label",
  "Create a label. `color` is a hex string like #a1a1aa.",
  { name: z.string(), color: z.string().optional() },
  (a) => api("/labels", { method: "POST", body: a }),
);

// ---- Support ----
tool(
  "list_tickets",
  "List support tickets, optionally by project id. Status: open|pending|solved|closed.",
  { product: z.string().optional() },
  (a) => api(`/tickets${query(a, ["product"])}`),
);

tool(
  "get_ticket",
  "Get one support ticket with its full comment thread.",
  { id: z.string() },
  (a) => api(`/tickets/${a.id}`),
);

tool(
  "create_ticket",
  "Create a support ticket. Priority: urgent|high|normal|low.",
  {
    subject: z.string(),
    body: z.string().optional(),
    projectId: z.string().optional(),
    accountId: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    requesterEmail: z.string().optional(),
    entity: z.string().optional(),
  },
  (a) => api("/tickets", { method: "POST", body: a }),
);

tool(
  "comment_on_ticket",
  "Reply on a support ticket's thread.",
  { id: z.string(), body: z.string() },
  (a) => api(`/tickets/${a.id}/comments`, { method: "POST", body: { body: a.body } }),
);

// ---- CRM / marketing / finance ----
tool(
  "list_deals",
  "List sales deals, optionally by project id. Stages: lead|qualified|proposal|negotiation|won|lost.",
  { product: z.string().optional() },
  (a) => api(`/deals${query(a, ["product"])}`),
);
tool(
  "create_deal",
  "Create a sales deal. Stage defaults to lead.",
  {
    name: z.string(),
    projectId: z.string().optional(),
    accountId: z.string().optional(),
    stage: z.string().optional(),
    value: z.number().optional(),
    entity: z.string().optional(),
    expectedClose: z.string().optional(),
  },
  (a) => api("/deals", { method: "POST", body: a }),
);

tool("list_accounts", "List CRM accounts (companies).", {}, () => api("/accounts"));
tool(
  "create_account",
  "Create a CRM account. type: prospect|customer|partner|churned.",
  {
    name: z.string(),
    website: z.string().optional(),
    industry: z.string().optional(),
    type: z.string().optional(),
    entity: z.string().optional(),
  },
  (a) => api("/accounts", { method: "POST", body: a }),
);

tool("list_contacts", "List CRM contacts (people).", {}, () => api("/contacts"));
tool(
  "create_contact",
  "Create a CRM contact, optionally linked to an account.",
  {
    name: z.string(),
    email: z.string().optional(),
    title: z.string().optional(),
    accountId: z.string().optional(),
    entity: z.string().optional(),
  },
  (a) => api("/contacts", { method: "POST", body: a }),
);

tool(
  "list_campaigns",
  "List marketing campaigns, optionally by project id.",
  { product: z.string().optional() },
  (a) => api(`/campaigns${query(a, ["product"])}`),
);
tool(
  "create_campaign",
  "Create a marketing campaign. channel: email|linkedin|events|content|paid|referral.",
  {
    name: z.string(),
    projectId: z.string().optional(),
    channel: z.string().optional(),
    status: z.string().optional(),
    budget: z.number().optional(),
    entity: z.string().optional(),
  },
  (a) => api("/campaigns", { method: "POST", body: a }),
);

tool(
  "list_invoices",
  "List invoices, optionally by project id.",
  { product: z.string().optional() },
  (a) => api(`/invoices${query(a, ["product"])}`),
);
tool(
  "create_invoice",
  "Create an invoice. status: draft|sent|paid|overdue.",
  {
    number: z.string().optional(),
    projectId: z.string().optional(),
    accountId: z.string().optional(),
    status: z.string().optional(),
    amount: z.number().optional(),
    entity: z.string().optional(),
    dueDate: z.string().optional(),
  },
  (a) => api("/invoices", { method: "POST", body: a }),
);

tool(
  "list_expenses",
  "List expenses, optionally by project id.",
  { product: z.string().optional() },
  (a) => api(`/expenses${query(a, ["product"])}`),
);
tool(
  "create_expense",
  "Create an expense. category: tooling|contractors|marketing|infra|other.",
  {
    vendor: z.string().optional(),
    projectId: z.string().optional(),
    category: z.string().optional(),
    amount: z.number().optional(),
    status: z.string().optional(),
    entity: z.string().optional(),
    spentDate: z.string().optional(),
  },
  (a) => api("/expenses", { method: "POST", body: a }),
);

// ---- Generic edit / delete ----
// Records that are a flat row (everything except issues and pages, which have
// their own tools) share one pair of tools so the schema stays small.
const RESOURCES = [
  "projects",
  "milestones",
  "features",
  "cycles",
  "labels",
  "deals",
  "accounts",
  "contacts",
  "campaigns",
  "invoices",
  "expenses",
  "tickets",
];

const WRITABLE = [
  "projects: name, description, tagline, url, startDate, targetDate, ownerId, strategistId",
  "milestones: name, description, targetDate, status, projectId",
  "features: title, status, startDate, targetDate, milestoneId, projectId, ownerId, pageId",
  "cycles: name, startDate, endDate",
  "labels: name, color",
  "deals: name, stage, value, entity, expectedClose, projectId, accountId, contactId, ownerId",
  "accounts: name, website, industry, type, entity, ownerId",
  "contacts: name, email, title, phone, lifecycleStage, source, accountId, entity, ownerId",
  "campaigns: name, channel, status, budget, reach, replies, conversions, startDate, endDate, projectId, entity, ownerId",
  "invoices: number, status, amount, issueDate, dueDate, projectId, accountId, entity, ownerId",
  "expenses: vendor, category, amount, status, spentDate, projectId, entity, ownerId",
  "tickets: subject, body, status, priority, assigneeId, requesterEmail, projectId, accountId, contactId, entity",
].join("; ");

tool(
  "update_record",
  `Edit a record. Pass only the fields to change. Writable fields — ${WRITABLE}. For issues use update_issue, for pages use update_page.`,
  {
    resource: z.enum(RESOURCES),
    id: z.string(),
    fields: z.record(z.string(), z.any()),
  },
  (a) => api(`/${a.resource}/${a.id}`, { method: "PATCH", body: a.fields }),
);

tool(
  "delete_record",
  "Permanently delete a record. This cannot be undone. For issues use delete_issue, for pages use delete_page (which is recoverable).",
  { resource: z.enum(RESOURCES), id: z.string() },
  (a) => api(`/${a.resource}/${a.id}`, { method: "DELETE" }),
);

// ---- Search ----
tool(
  "search",
  "Search issues, pages, and projects by keyword.",
  { q: z.string() },
  (a) => api(`/search?q=${encodeURIComponent(a.q)}`),
);

const transport = new StdioServerTransport();
await server.connect(transport);
