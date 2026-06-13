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

- JSON in, JSON out. A single resource returns `{ "data": {...} }`.
- Errors return `{ "error": "message" }` with a 4xx/5xx status.

## Pagination

`/issues` and `/pages` are cursor-paginated and return:

```json
{ "data": [ ... ], "next_cursor": "eyJ..." | null }
```

Pass `?limit=` (1–200, default 50) and `?cursor=<next_cursor>` to page forward.
A `null` cursor means there are no more results. Other list endpoints
(`/projects`, `/cycles`, `/initiatives`, `/teams`) return the full set as
`{ "data": [...], "count": n }`.

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

## Webhooks

Register endpoints in **Settings → API & MCP → Webhooks**. The workspace POSTs a
JSON body to your URL on each subscribed event:

```json
{
  "event": "issue.created",
  "workspaceId": "…",
  "data": { "id": "…", "title": "…", "status": "backlog", "priority": "high" },
  "timestamp": "2026-06-13T15:00:00.000Z"
}
```

Events: `issue.created`, `issue.updated`, `issue.deleted`, `issue.commented`,
`project.created`, `page.created` (or subscribe to all).

Each request carries `X-Internal-Event` and a signature header:

```
X-Internal-Signature: sha256=<hmac>
```

Verify it by computing `HMAC_SHA256(secret, rawBody)` (hex) and comparing — the
secret is shown once when you create the webhook. Deliveries time out after 5s;
the last status is shown in the dashboard.

## MCP

The same surface is available to AI agents via the MCP server in `mcp/` — see
`mcp/README.md`. Point it at this API with an API key and any MCP client
(Claude Desktop, Claude Code) can drive the workspace in natural language.
