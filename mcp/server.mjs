#!/usr/bin/env node
// MCP server for the Internal workspace. Wraps the REST API (/api/v1) as tools
// so any MCP client (Claude Desktop, Claude Code, agents) can drive the
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

const server = new McpServer({ name: "internal", version: "1.0.0" });

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

// ---- Workspace ----
tool("whoami", "Get the current workspace this API key belongs to.", {}, () =>
  api("/me"),
);

// ---- Issues ----
tool(
  "list_issues",
  "List issues, optionally filtered by status, project id, or assignee id.",
  {
    status: z.string().optional(),
    project: z.string().optional(),
    assignee: z.string().optional(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  (a) => {
    const q = new URLSearchParams();
    for (const k of ["status", "project", "assignee", "limit"])
      if (a[k] != null) q.set(k, String(a[k]));
    const s = q.toString();
    return api(`/issues${s ? `?${s}` : ""}`);
  },
);

tool("get_issue", "Get a single issue by id.", { id: z.string() }, (a) =>
  api(`/issues/${a.id}`),
);

tool(
  "create_issue",
  "Create an issue. Status: backlog|todo|in_progress|in_review|done|canceled. Priority: urgent|high|medium|low|none.",
  {
    title: z.string(),
    projectId: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    assigneeId: z.string().optional(),
    estimate: z.number().optional(),
    dueDate: z.string().optional(),
    description: z.string().optional(),
  },
  (a) => api("/issues", { method: "POST", body: a }),
);

tool(
  "update_issue",
  "Update fields on an issue. Pass only the fields to change.",
  {
    id: z.string(),
    title: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    assigneeId: z.string().nullable().optional(),
    projectId: z.string().nullable().optional(),
    estimate: z.number().nullable().optional(),
    dueDate: z.string().nullable().optional(),
    description: z.string().optional(),
  },
  ({ id, ...patch }) => api(`/issues/${id}`, { method: "PATCH", body: patch }),
);

tool("delete_issue", "Delete an issue by id.", { id: z.string() }, (a) =>
  api(`/issues/${a.id}`, { method: "DELETE" }),
);

tool(
  "comment_on_issue",
  "Add a comment to an issue.",
  { id: z.string(), body: z.string() },
  (a) => api(`/issues/${a.id}/comments`, { method: "POST", body: { body: a.body } }),
);

// ---- Projects / planning ----
tool("list_projects", "List projects.", {}, () => api("/projects"));
tool(
  "create_project",
  "Create a project (the key prefix is derived if omitted).",
  { name: z.string(), key: z.string().optional(), description: z.string().optional() },
  (a) => api("/projects", { method: "POST", body: a }),
);
tool("list_cycles", "List cycles (sprints).", {}, () => api("/cycles"));
tool("list_initiatives", "List initiatives.", {}, () => api("/initiatives"));
tool("list_teams", "List teams.", {}, () => api("/teams"));

// ---- Docs ----
tool("list_pages", "List doc pages.", {}, () => api("/pages"));
tool("get_page", "Get a page by id (includes markdown).", { id: z.string() }, (a) =>
  api(`/pages/${a.id}`),
);
tool(
  "create_page",
  "Create a doc page. `content` is plain text/markdown.",
  { title: z.string(), content: z.string().optional() },
  (a) => api("/pages", { method: "POST", body: a }),
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
