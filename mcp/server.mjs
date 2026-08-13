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

const server = new McpServer({ name: "internal", version: "3.0.0" });

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
    assigneeIds: z.array(z.string()).optional(),
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
    assigneeIds: z.array(z.string()).optional(),
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

// ---- Task collaboration: comments, relations, links, attachments ----
tool(
  "list_issue_comments",
  "Read a task's comment thread.",
  { id: z.string() },
  (a) => api(`/issues/${a.id}/comments`),
);

tool(
  "delete_comment",
  "Delete a task comment by its comment id.",
  { id: z.string() },
  (a) => api(`/comments/${a.id}`, { method: "DELETE" }),
);

tool(
  "link_issues",
  "Relate two tasks. type: blocks | blocked_by | related | duplicate.",
  {
    id: z.string(),
    relatedIssueId: z.string(),
    type: z.enum(["blocks", "blocked_by", "related", "duplicate"]).optional(),
  },
  ({ id, ...body }) => api(`/issues/${id}/relations`, { method: "POST", body }),
);

tool(
  "unlink_issues",
  "Remove a task relationship by its relation id (from get_issue or list_issue_relations).",
  { relationId: z.string() },
  (a) => api(`/relations/${a.relationId}`, { method: "DELETE" }),
);

tool(
  "list_issue_relations",
  "List a task's blocks / blocked-by / related / duplicate edges.",
  { id: z.string() },
  (a) => api(`/issues/${a.id}/relations`),
);

tool(
  "link_issue_to_page",
  "Link a task to a doc page (bidirectional).",
  { id: z.string(), pageId: z.string() },
  (a) => api(`/issues/${a.id}/pages`, { method: "POST", body: { pageId: a.pageId } }),
);

tool(
  "unlink_issue_from_page",
  "Remove a task <-> page link.",
  { id: z.string(), pageId: z.string() },
  (a) =>
    api(`/issues/${a.id}/pages?pageId=${encodeURIComponent(a.pageId)}`, {
      method: "DELETE",
    }),
);

tool(
  "list_attachments",
  "List files attached to a task.",
  { id: z.string() },
  (a) => api(`/issues/${a.id}/attachments`),
);

tool(
  "attach_file",
  "Attach an already-hosted file to a task by URL. Binary upload stays in the app.",
  {
    id: z.string(),
    name: z.string(),
    url: z.string(),
    contentType: z.string().optional(),
    size: z.number().optional(),
  },
  ({ id, ...body }) => api(`/issues/${id}/attachments`, { method: "POST", body }),
);

// ---- Doc collaboration: comments, history, trash ----
tool(
  "list_page_comments",
  "Read a doc page's comment threads.",
  { id: z.string() },
  (a) => api(`/pages/${a.id}/comments`),
);

tool(
  "comment_on_page",
  "Comment on a doc page. `parentId` makes it a reply.",
  {
    id: z.string(),
    body: z.string(),
    parentId: z.string().optional(),
    blockId: z.string().optional(),
  },
  ({ id, ...body }) => api(`/pages/${id}/comments`, { method: "POST", body }),
);

tool(
  "resolve_page_comment",
  "Resolve or reopen a page comment thread.",
  { commentId: z.string(), resolved: z.boolean() },
  (a) =>
    api(`/page-comments/${a.commentId}`, {
      method: "PATCH",
      body: { resolved: a.resolved },
    }),
);

tool(
  "list_page_versions",
  "List a page's version history (newest first).",
  { id: z.string() },
  (a) => api(`/pages/${a.id}/versions`),
);

tool(
  "restore_page_version",
  "Roll a page back to a previous version. The current state is snapshotted first, so this is undoable.",
  { id: z.string(), versionId: z.string() },
  (a) =>
    api(`/pages/${a.id}/versions`, {
      method: "POST",
      body: { versionId: a.versionId },
    }),
);

tool("list_trash", "List trashed pages.", {}, () => api("/trash"));

tool(
  "restore_page",
  "Restore a trashed page and anything trashed with it.",
  { id: z.string() },
  (a) => api(`/trash/${a.id}`, { method: "POST" }),
);

tool(
  "purge_page",
  "Permanently delete a page that is already in the trash. Cannot be undone.",
  { id: z.string() },
  (a) => api(`/trash/${a.id}`, { method: "DELETE" }),
);

// ---- Analytics: metrics ----
tool(
  "list_metrics",
  "List KPIs with their latest and previous values, optionally by project id.",
  { project: z.string().optional() },
  (a) => api(`/metrics${query(a, ["project"])}`),
);

tool(
  "create_metric",
  "Define a KPI. cadence: weekly|monthly|quarterly.",
  {
    name: z.string(),
    projectId: z.string().optional(),
    unit: z.string().optional(),
    cadence: z.string().optional(),
    isNorthStar: z.boolean().optional(),
  },
  (a) => api("/metrics", { method: "POST", body: a }),
);

tool(
  "list_metric_points",
  "Read a KPI's time series.",
  { id: z.string() },
  (a) => api(`/metrics/${a.id}/points`),
);

tool(
  "record_metric_point",
  "Record a KPI value for a period. `periodDate` is ISO (YYYY-MM-DD).",
  { id: z.string(), periodDate: z.string(), value: z.number() },
  ({ id, ...body }) => api(`/metrics/${id}/points`, { method: "POST", body }),
);

// ---- Product: feedback ----
tool(
  "list_feedback",
  "List product feedback, optionally by project id.",
  { project: z.string().optional() },
  (a) => api(`/feedback${query(a, ["project"])}`),
);

tool(
  "create_feedback",
  "Capture product feedback. source: customer|sales|support|interview|internal|other. status: new|reviewing|planned|declined|shipped.",
  {
    title: z.string(),
    body: z.string().optional(),
    projectId: z.string().optional(),
    source: z.string().optional(),
    status: z.string().optional(),
    votes: z.number().optional(),
    contact: z.string().optional(),
    featureId: z.string().optional(),
  },
  (a) => api("/feedback", { method: "POST", body: a }),
);

// ---- Marketing: content calendar ----
tool(
  "list_content",
  "List content-calendar items, optionally by project id.",
  { project: z.string().optional() },
  (a) => api(`/content${query(a, ["project"])}`),
);

tool(
  "create_content",
  "Add a content item. status: idea|draft|scheduled|published.",
  {
    title: z.string(),
    projectId: z.string().optional(),
    campaignId: z.string().optional(),
    channel: z.string().optional(),
    status: z.string().optional(),
    url: z.string().optional(),
    notes: z.string().optional(),
    publishDate: z.string().optional(),
    ownerId: z.string().optional(),
  },
  (a) => api("/content", { method: "POST", body: a }),
);

// ---- Weekly review ----
tool(
  "list_status_updates",
  "List a project's weekly status updates.",
  { project: z.string() },
  (a) => api(`/status-updates${query(a, ["project"])}`),
);

tool(
  "post_status_update",
  "Post a weekly project status update. health: on_track|at_risk|off_track.",
  { projectId: z.string(), health: z.string(), body: z.string().optional() },
  (a) => api("/status-updates", { method: "POST", body: a }),
);

// ---- CRM activity log ----
tool(
  "list_activities",
  "List CRM activities (calls, meetings, follow-ups), optionally by deal or account id.",
  { deal: z.string().optional(), account: z.string().optional() },
  (a) => api(`/activities${query(a, ["deal", "account"])}`),
);

tool(
  "log_activity",
  "Log a CRM activity against a deal, account or contact. type: note|call|email|task|meeting.",
  {
    type: z.string().optional(),
    body: z.string().optional(),
    dueDate: z.string().optional(),
    done: z.boolean().optional(),
    dealId: z.string().optional(),
    accountId: z.string().optional(),
    contactId: z.string().optional(),
    projectId: z.string().optional(),
  },
  (a) => api("/activities", { method: "POST", body: a }),
);

// ---- People: members and the org chart ----
tool(
  "add_member",
  "Add someone to the workspace, creating the user when the email is new. role: admin|member.",
  {
    email: z.string(),
    name: z.string().optional(),
    role: z.string().optional(),
    title: z.string().optional(),
  },
  (a) => api("/users", { method: "POST", body: a }),
);

tool(
  "update_member",
  "Update a member's role or HR profile. entity: India|Netherlands|Global. employment: employee|contractor.",
  {
    id: z.string(),
    role: z.string().optional(),
    title: z.string().optional(),
    entity: z.string().optional(),
    employment: z.string().optional(),
    startDate: z.string().nullable().optional(),
    managerId: z.string().nullable().optional(),
  },
  ({ id, ...patch }) => api(`/users/${id}`, { method: "PATCH", body: patch }),
);

tool(
  "remove_member",
  "Remove someone from the workspace. Their authored history is kept.",
  { id: z.string() },
  (a) => api(`/users/${a.id}`, { method: "DELETE" }),
);

tool("list_org_roles", "Read the org chart as a tree of positions.", {}, () =>
  api("/org-roles"),
);

tool(
  "create_org_role",
  "Add an org-chart position. `parentId` nests it under another role.",
  {
    title: z.string(),
    userId: z.string().optional(),
    parentId: z.string().optional(),
  },
  (a) => api("/org-roles", { method: "POST", body: a }),
);

// ---- Notion-style databases ----
tool("list_databases", "List the workspace's databases.", {}, () =>
  api("/databases"),
);

tool(
  "get_database",
  "Get a database with its field schema and all rows.",
  { id: z.string() },
  (a) => api(`/databases/${a.id}`),
);

tool(
  "create_database",
  "Create a database (table).",
  { name: z.string().optional(), icon: z.string().optional() },
  (a) => api("/databases", { method: "POST", body: a }),
);

tool(
  "add_database_field",
  "Add a column. type: text|number|select|checkbox|date|relation|rollup. For select, pass `options` as [{label,color}].",
  {
    id: z.string(),
    name: z.string(),
    type: z.string().optional(),
    options: z.any().optional(),
  },
  ({ id, ...body }) => api(`/databases/${id}/fields`, { method: "POST", body }),
);

tool(
  "delete_database_field",
  "Delete a column from a database.",
  { id: z.string(), fieldId: z.string() },
  (a) => api(`/databases/${a.id}/fields/${a.fieldId}`, { method: "DELETE" }),
);

tool(
  "add_database_row",
  "Add a row. `values` is keyed by field id — call get_database first for the schema.",
  { id: z.string(), values: z.record(z.string(), z.any()) },
  (a) => api(`/databases/${a.id}/rows`, { method: "POST", body: a.values }),
);

tool(
  "update_database_row",
  "Update cells on a row. Merges — omitted fields keep their current value.",
  { id: z.string(), rowId: z.string(), values: z.record(z.string(), z.any()) },
  (a) =>
    api(`/databases/${a.id}/rows/${a.rowId}`, { method: "PATCH", body: a.values }),
);

tool(
  "delete_database_row",
  "Delete a row from a database.",
  { id: z.string(), rowId: z.string() },
  (a) => api(`/databases/${a.id}/rows/${a.rowId}`, { method: "DELETE" }),
);

// ---- Notifications ----
tool(
  "list_notifications",
  "List notifications for the member this key acts as. Pass unread=true for only unread ones.",
  { unread: z.boolean().optional() },
  (a) => api(`/notifications${a.unread ? "?unread=true" : ""}`),
);

tool(
  "mark_notifications_read",
  "Mark one notification read, or all of them when `id` is omitted.",
  { id: z.string().optional() },
  (a) => api("/notifications", { method: "POST", body: { id: a.id } }),
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
  "metrics",
  "feedback",
  "content",
  "org-roles",
  "activities",
  "status-updates",
  "attachments",
  "page-comments",
  "databases",
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
  "metrics: name, unit, cadence, isNorthStar, projectId",
  "feedback: title, body, source, status, votes, contact, featureId, projectId",
  "content: title, channel, status, url, notes, publishDate, campaignId, projectId, ownerId",
  "org-roles: title, userId, parentId",
  "activities: type, body, dueDate, done, accountId, contactId, dealId, projectId",
  "status-updates: health, body",
  "attachments: name",
  "page-comments: body",
  "databases: name, icon",
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
