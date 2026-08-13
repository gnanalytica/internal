# Internal — MCP server

An [MCP](https://modelcontextprotocol.io) server that exposes the Internal
workspace (issues, docs, projects, tickets, CRM, finance, search) as tools for
AI agents. It's a thin client over the REST API at `/api/v1`, so it shares the
same auth and behaviour.

## Setup

Not published to npm — this is internal tooling, and `package.json` is marked
`private` so it cannot be published by accident. Install it from a clone of
this repo.

```bash
git clone https://github.com/gnanalytica/internal.git
cd internal/mcp && pnpm install
```

Then get an API key from the app: **Settings → API & MCP → Create key**
(admins), and point your client at the absolute path.

### Claude Code

```bash
claude mcp add internal \
  --env INTERNAL_API_KEY=int_your_key_here \
  --env INTERNAL_API_URL=https://internal.gnanalytica.com/api/v1 \
  -- node /absolute/path/to/internal/mcp/server.mjs
```

### Claude Desktop / Cursor

Claude Desktop config, or Cursor's `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "internal": {
      "command": "node",
      "args": ["/absolute/path/to/internal/mcp/server.mjs"],
      "env": {
        "INTERNAL_API_URL": "https://internal.gnanalytica.com/api/v1",
        "INTERNAL_API_KEY": "int_your_key_here"
      }
    }
  }
}
```

Each person should use their own key: every write is attributed to the member
who created the key, so a shared key makes every agent edit look like it came
from one person.

## Tools

**Workspace** — `whoami`, `list_users`, `search`, `list_notifications`,
`mark_notifications_read`

**Tasks** — `list_issues`, `get_issue`, `create_issue`, `update_issue`,
`delete_issue`, `comment_on_issue`, `list_issue_comments`, `delete_comment`,
`link_issues`, `unlink_issues`, `list_issue_relations`, `link_issue_to_page`,
`unlink_issue_from_page`, `list_attachments`, `attach_file`

**Docs** — `list_pages`, `get_page`, `create_page`, `update_page`, `delete_page`,
`list_page_comments`, `comment_on_page`, `resolve_page_comment`,
`list_page_versions`, `restore_page_version`, `list_trash`, `restore_page`,
`purge_page`

**Planning** — `list_projects`, `create_project`, `list_cycles`, `create_cycle`,
`list_milestones`, `create_milestone`, `list_features`, `create_feature`,
`list_labels`, `create_label`

**Support** — `list_tickets`, `get_ticket`, `create_ticket`, `comment_on_ticket`

**Analytics** — `list_metrics`, `create_metric`, `list_metric_points`,
`record_metric_point`

**Product feedback** — `list_feedback`, `create_feedback`

**Marketing content** — `list_content`, `create_content`

**Weekly review** — `list_status_updates`, `post_status_update`

**People** — `add_member`, `update_member`, `remove_member`, `list_org_roles`,
`create_org_role`

**Databases (Notion-style tables)** — `list_databases`, `get_database`,
`create_database`, `add_database_field`, `delete_database_field`,
`add_database_row`, `update_database_row`, `delete_database_row`

**CRM / marketing / finance** — `list_deals`, `create_deal`, `list_accounts`,
`create_account`, `list_contacts`, `create_contact`, `list_campaigns`,
`create_campaign`, `list_invoices`, `create_invoice`, `list_expenses`,
`create_expense`, `list_activities`, `log_activity`

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
- **Several people can own a task.** `assigneeIds` sets the whole assignee
  set; `assigneeId` still works for a single owner and becomes the primary.
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
