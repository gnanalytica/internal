# Internal — MCP server

An [MCP](https://modelcontextprotocol.io) server that exposes the Internal
workspace (issues, docs, projects, tickets, CRM, finance, search) as tools for
AI agents. It's a thin client over the REST API at `/api/v1`, so it shares the
same auth and behaviour.

## Setup

1. Get an API key from the app: **Settings → API & MCP → Create key** (admins).
2. Add the server to your client (below). Nothing to clone or build if you use
   the published package.

### Claude Code

```bash
claude mcp add internal \
  --env INTERNAL_API_KEY=int_your_key_here \
  --env INTERNAL_API_URL=https://internal.gnanalytica.com/api/v1 \
  -- npx -y @gnanalytica/internal-mcp
```

### Claude Desktop / Cursor

Claude Desktop config, or Cursor's `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "internal": {
      "command": "npx",
      "args": ["-y", "@gnanalytica/internal-mcp"],
      "env": {
        "INTERNAL_API_URL": "https://internal.gnanalytica.com/api/v1",
        "INTERNAL_API_KEY": "int_your_key_here"
      }
    }
  }
}
```

### From this repo (development)

```bash
cd mcp && pnpm install
INTERNAL_API_KEY=int_xxx node server.mjs
```

…and point the client's `command`/`args` at `node /absolute/path/to/mcp/server.mjs`.

## Tools

**Workspace** — `whoami`, `list_users`, `search`

**Tasks** — `list_issues`, `get_issue`, `create_issue`, `update_issue`,
`delete_issue`, `comment_on_issue`

**Docs** — `list_pages`, `get_page`, `create_page`, `update_page`, `delete_page`

**Planning** — `list_projects`, `create_project`, `list_cycles`, `create_cycle`,
`list_milestones`, `create_milestone`, `list_features`, `create_feature`,
`list_labels`, `create_label`

**Support** — `list_tickets`, `get_ticket`, `create_ticket`, `comment_on_ticket`

**CRM / marketing / finance** — `list_deals`, `create_deal`, `list_accounts`,
`create_account`, `list_contacts`, `create_contact`, `list_campaigns`,
`create_campaign`, `list_invoices`, `create_invoice`, `list_expenses`,
`create_expense`

**Editing anything else** — `update_record` and `delete_record` take a
`resource` (`projects`, `milestones`, `features`, `cycles`, `labels`, `deals`,
`accounts`, `contacts`, `campaigns`, `invoices`, `expenses`, `tickets`) plus the
fields to change, so every record type is editable without a separate tool per
field.

## Notes

- **Tasks are not only engineering.** Every task carries a `type` — the
  department it belongs to: `engineering`, `product`, `research`, `marketing`,
  `sales`, `ops`, `legal`, `finance`, `people`, `admin`. It defaults to
  `engineering`, so set it explicitly for other teams, and filter a
  department's work with `list_issues type=marketing`.
- **Full task metadata is writable** — assignee, labels, estimate, start/due
  dates, priority, parent task, and the cycle / milestone / feature it rolls up
  to. `update_issue` reassigns, reschedules and moves work between departments.
- **Planning chain**: `Project → Milestone → Feature → Task`. Milestones are
  dated phases with a review status (`on_track`, `at_risk`, …); slip a date with
  `update_record resource=milestones`.
- **Documents are Markdown.** `create_page` / `update_page` accept headings,
  lists, task lists, tables, code fences and inline formatting, and `get_page`
  returns Markdown back. `update_page` replaces the whole body — read first,
  then send the full edited document.
- **Deletes are permanent**, except `delete_page`, which trashes the page and
  its sub-pages (recoverable from **/trash** in the app).
- **Resolve people with `list_users`.** Tools take `assigneeId` / `ownerId` as
  ids, not names.
- **The key acts as the member who created it** — every write is attributed to
  them in the activity feed. `whoami` shows who that is.

## Env

| Variable           | Default                                   |
| ------------------ | ----------------------------------------- |
| `INTERNAL_API_URL` | `https://internal.gnanalytica.com/api/v1` |
| `INTERNAL_API_KEY` | _(required)_ — a workspace API key        |
