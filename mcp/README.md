# Internal — MCP server

An [MCP](https://modelcontextprotocol.io) server that exposes the Internal
workspace (issues, projects, cycles, initiatives, teams, docs, search) as tools
for AI agents. It's a thin client over the REST API at `/api/v1`, so it shares
the same auth and behavior.

## Tools

`whoami`, `list_issues`, `get_issue`, `create_issue`, `update_issue`,
`delete_issue`, `comment_on_issue`, `list_projects`, `create_project`,
`list_cycles`, `list_initiatives`, `list_teams`, `list_pages`, `get_page`,
`create_page`, `search`.

## Setup

```bash
cd mcp
npm install
```

Get an API key from the app: **Settings → API & MCP → Create key** (admins).

Run it (env-configured):

```bash
INTERNAL_API_KEY=int_xxx \
INTERNAL_API_URL=https://internal.gnanalytica.com/api/v1 \
node server.mjs
```

## Add to Claude Desktop / Claude Code

`~/.claude/mcp.json` (Claude Code) or the Claude Desktop config:

```json
{
  "mcpServers": {
    "internal": {
      "command": "node",
      "args": ["/absolute/path/to/notion/mcp/server.mjs"],
      "env": {
        "INTERNAL_API_URL": "https://internal.gnanalytica.com/api/v1",
        "INTERNAL_API_KEY": "int_your_key_here"
      }
    }
  }
}
```

Then ask your agent things like *"create an issue in the Web project to fix the
login bug, high priority"* or *"summarize the open issues assigned to me."*

## Env

| Variable           | Default                                          |
| ------------------ | ------------------------------------------------ |
| `INTERNAL_API_URL` | `https://internal.gnanalytica.com/api/v1`        |
| `INTERNAL_API_KEY` | _(required)_ — a workspace API key               |
