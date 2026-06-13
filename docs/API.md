# Internal REST API (v1)

Programmatic access to the workspace. Same data model as the app, scoped to the
workspace that owns the API key.

## Auth

Create a key in **Settings → API & MCP** (admins only). Send it on every request:

```
Authorization: Bearer int_xxxxxxxx
```

(`X-API-Key: int_xxxxxxxx` also works.)

Base URL: `https://<your-app>/api/v1`

## Conventions

- JSON in, JSON out. List endpoints return `{ "data": [...], "count": n }`.
- A single resource returns `{ "data": {...} }`.
- Errors return `{ "error": "message" }` with a 4xx/5xx status.

## Endpoints

| Method   | Path                          | Description                                   |
| -------- | ----------------------------- | --------------------------------------------- |
| `GET`    | `/me`                         | The workspace this key belongs to             |
| `GET`    | `/issues`                     | List issues (`?status=&project=&assignee=&limit=`) |
| `POST`   | `/issues`                     | Create an issue                               |
| `GET`    | `/issues/{id}`                | Get an issue                                  |
| `PATCH`  | `/issues/{id}`                | Update an issue                               |
| `DELETE` | `/issues/{id}`                | Delete an issue                               |
| `POST`   | `/issues/{id}/comments`       | Comment on an issue (`{ "body": "..." }`)     |
| `GET`    | `/projects`                   | List projects                                 |
| `POST`   | `/projects`                   | Create a project                              |
| `GET`    | `/cycles`                     | List cycles                                   |
| `GET`    | `/initiatives`                | List initiatives                              |
| `GET`    | `/teams`                      | List teams                                    |
| `GET`    | `/pages`                      | List doc pages                                |
| `POST`   | `/pages`                      | Create a doc page                             |
| `GET`    | `/pages/{id}`                 | Get a page (with markdown)                    |
| `GET`    | `/search?q=`                  | Search issues, pages, projects                |

### Create an issue

```bash
curl -X POST https://your-app/api/v1/issues \
  -H "Authorization: Bearer int_xxx" \
  -H "content-type: application/json" \
  -d '{
    "title": "Fix the login bug",
    "priority": "high",
    "projectId": "<project-uuid>",
    "description": "Repro: ..."
  }'
```

`status`: `backlog | todo | in_progress | in_review | done | canceled`
`priority`: `urgent | high | medium | low | none`

## MCP

The same surface is available to AI agents via the MCP server in `mcp/` — see
`mcp/README.md`. Point it at this API with an API key and any MCP client
(Claude Desktop, Claude Code) can drive the workspace in natural language.
