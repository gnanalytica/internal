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
(`/projects`, `/cycles`, `/users`) return the full set as
`{ "data": [...], "count": n }`.

## Endpoints

| Method   | Path                          | Description                                   |
| -------- | ----------------------------- | --------------------------------------------- |
| `GET`    | `/me`                         | Workspace, the member this key acts as, and the key |
| `GET`    | `/users`                      | List workspace members (`?email=` to resolve one) |
| `GET`    | `/issues`                     | List tasks (`?status=&project=&assignee=&type=&cycle=&milestone=&updatedSince=&limit=`) |
| `POST`   | `/issues`                     | Create a task (any department); idempotent on `externalId` |
| `GET`    | `/issues/{id}`                | Get a task in full (assignees, sub-tasks, comments, relations, linked docs, attachments) |
| `PATCH`  | `/issues/{id}`                | Update an issue                               |
| `DELETE` | `/issues/{id}`                | Delete an issue                               |
| `GET`    | `/issues/{id}/comments`       | Read a task's comment thread                  |
| `POST`   | `/issues/{id}/comments`       | Comment on a task (`{ "body": "..." }`)       |
| `DELETE` | `/comments/{id}`              | Delete a task comment                         |
| `GET`    | `/issues/{id}/relations`      | List blocks / blocked-by / related edges      |
| `POST`   | `/issues/{id}/relations`      | Relate two tasks                              |
| `DELETE` | `/relations/{id}`             | Remove a relationship                         |
| `POST`   | `/issues/{id}/pages`          | Link a task to a doc                          |
| `DELETE` | `/issues/{id}/pages?pageId=`  | Unlink a task from a doc                      |
| `GET`    | `/issues/{id}/attachments`    | List a task's files                           |
| `POST`   | `/issues/{id}/attachments`    | Attach a hosted file by URL                   |
| `GET`    | `/projects`                   | List projects                                 |
| `POST`   | `/projects`                   | Create a project                              |
| `PATCH`  | `/projects/{id}`              | Update a project                              |
| `DELETE` | `/projects/{id}`              | Delete a project                              |
| `GET`    | `/cycles`                     | List cycles                                   |
| `POST`   | `/cycles`                     | Create a cycle (sprint)                       |
| `GET`    | `/milestones?project=`        | List a project's milestones + progress        |
| `POST`   | `/milestones`                 | Create a milestone                            |
| `GET`    | `/features`                   | List features (`?project=`)                   |
| `POST`   | `/features`                   | Create a feature                              |
| `GET`    | `/labels`                     | List labels                                   |
| `POST`   | `/labels`                     | Create a label                                |
| `GET`    | `/pages`                      | List doc pages                                |
| `POST`   | `/pages`                      | Create a doc page (Markdown body)             |
| `GET`    | `/pages/{id}`                 | Get a page (with markdown)                    |
| `PATCH`  | `/pages/{id}`                 | Update a page's title, icon or body           |
| `DELETE` | `/pages/{id}`                 | Move a page + sub-pages to the trash          |
| `GET`    | `/pages/{id}/comments`        | Read a doc's comment threads                  |
| `POST`   | `/pages/{id}/comments`        | Comment on a doc                              |
| `PATCH`  | `/page-comments/{id}`         | Edit, resolve or reopen (`{ "resolved": true }`) |
| `DELETE` | `/page-comments/{id}`         | Delete a doc comment                          |
| `GET`    | `/pages/{id}/versions`        | List a doc's version history                  |
| `POST`   | `/pages/{id}/versions`        | Restore a version (`{ "versionId": "..." }`)  |
| `GET`    | `/trash`                      | List trashed pages                            |
| `POST`   | `/trash/{id}`                 | Restore a trashed page                        |
| `DELETE` | `/trash/{id}`                 | Permanently delete a trashed page             |
| `GET`    | `/metrics`                    | List KPIs with latest/previous (`?project=`)  |
| `POST`   | `/metrics`                    | Define a KPI                                  |
| `GET`    | `/metrics/{id}/points`        | Read a KPI's time series                      |
| `POST`   | `/metrics/{id}/points`        | Record a KPI value                            |
| `DELETE` | `/metrics/{id}/points/{pointId}` | Delete a KPI value                         |
| `GET`    | `/feedback`                   | List product feedback (`?project=`)           |
| `POST`   | `/feedback`                   | Capture feedback                              |
| `GET`    | `/content`                    | List content-calendar items (`?project=`)     |
| `POST`   | `/content`                    | Add a content item                            |
| `GET`    | `/status-updates?project=`    | List weekly project status updates            |
| `POST`   | `/status-updates`             | Post a status update                          |
| `GET`    | `/activities`                 | List CRM activities (`?deal=&account=`)       |
| `POST`   | `/activities`                 | Log a call, meeting or follow-up              |
| `GET`    | `/org-roles`                  | Read the org chart as a tree                  |
| `POST`   | `/org-roles`                  | Add an org-chart position                     |
| `POST`   | `/users`                      | Add a member (creates the user if new)        |
| `PATCH`  | `/users/{id}`                 | Update role or HR profile                     |
| `DELETE` | `/users/{id}`                 | Remove someone from the workspace             |
| `GET`    | `/databases`                  | List databases                                |
| `POST`   | `/databases`                  | Create a database                             |
| `GET`    | `/databases/{id}`             | Get a database with fields and rows           |
| `POST`   | `/databases/{id}/fields`      | Add a column                                  |
| `DELETE` | `/databases/{id}/fields/{fieldId}` | Delete a column                          |
| `POST`   | `/databases/{id}/rows`        | Add a row (body = cell values by field id)    |
| `PATCH`  | `/databases/{id}/rows/{rowId}`| Update cells (merges)                         |
| `DELETE` | `/databases/{id}/rows/{rowId}`| Delete a row                                  |
| `GET`    | `/notifications`              | Your notifications (`?unread=true`)           |
| `POST`   | `/notifications`              | Mark one read, or all when `id` is omitted    |
| `GET`    | `/search?q=`                  | Search issues, pages, projects, tickets, deals, accounts, contacts, milestones, features |
| `GET`    | `/deals`                      | List sales deals (`?product=`)                |
| `POST`   | `/deals`                      | Create a deal                                 |
| `GET`    | `/accounts`                   | List CRM accounts                             |
| `POST`   | `/accounts`                   | Create an account                             |
| `GET`    | `/contacts`                   | List CRM contacts                             |
| `POST`   | `/contacts`                   | Create a contact                              |
| `GET`    | `/campaigns`                  | List marketing campaigns (`?product=`)        |
| `POST`   | `/campaigns`                  | Create a campaign                             |
| `GET`    | `/invoices`                   | List invoices (`?product=`)                   |
| `POST`   | `/invoices`                   | Create an invoice                             |
| `GET`    | `/expenses`                   | List expenses (`?product=`)                   |
| `POST`   | `/expenses`                   | Create an expense                             |
| `GET`    | `/tickets`                    | List support tickets (`?product=`)            |
| `POST`   | `/tickets`                    | Create a ticket                               |
| `GET`    | `/tickets/{id}`               | Get a ticket with its comment thread          |
| `POST`   | `/tickets/{id}/comments`      | Reply on a ticket (`{ "body": "..." }`)       |

Every record type below also supports `PATCH /{resource}/{id}` and
`DELETE /{resource}/{id}`: `projects`, `milestones`, `features`, `cycles`,
`labels`, `deals`, `accounts`, `contacts`, `campaigns`, `invoices`,
`expenses`, `tickets`, `metrics`, `feedback`, `content`, `org-roles`,
`activities`, `status-updates`, `attachments`, `page-comments`, `databases`.

The CRM / Sales / Marketing / Finance / Support endpoints belong to the
**Product × Department matrix**: every record carries a product, so `?product=<id>`
gives the product lens and omitting it gives the company-wide department lens.
These list endpoints return the full set as `{ "data": [...], "count": n }`.

### Tasks are not only engineering

A task carries a `type` — the department the work belongs to. It defaults to
`engineering`, so always set it explicitly for other teams:

`type`: `engineering | product | research | marketing | sales | ops | legal |
finance | people | admin`

Filter a department's work with `GET /issues?type=marketing`.

```bash
curl -X POST https://your-app/api/v1/issues \
  -H "Authorization: Bearer int_xxx" \
  -H "content-type: application/json" \
  -d '{
    "title": "Launch campaign brief",
    "type": "marketing",
    "priority": "high",
    "projectId": "<project-uuid>",
    "assigneeId": "<user-uuid>",
    "milestoneId": "<milestone-uuid>",
    "cycleId": "<cycle-uuid>",
    "labelIds": ["<label-uuid>"],
    "estimate": 3,
    "startDate": "2026-08-18",
    "dueDate": "2026-08-25",
    "description": "## Brief\n\n- [ ] positioning"
  }'
```

`status`: `backlog | todo | in_progress | in_review | done | canceled`
`priority`: `urgent | high | medium | low | none`
`type`: see `ISSUE_TYPES` in `src/lib/constants.ts` (default `engineering`)

Accepted fields: `title` (required), `description`, `projectId`, `status`,
`priority`, `type`, `assigneeId`, `assigneeEmail`, `creatorEmail`, `labels`,
`estimate`, `startDate`, `dueDate`, `externalSource`, `externalId`,
`externalUrl`.

### Assigning by email

Integrations rarely know our user uuids. Send `assigneeEmail` instead of
`assigneeId` and we resolve it against the members of the key's workspace:

```json
{ "title": "Ship the invoice export", "assigneeEmail": "raunak@gnanalytica.com" }
```

An address we do not recognise **files the issue unassigned** rather than
failing — creating an issue is usually a human decision on your side and must
not break because our directory is missing someone. Use `GET /users` to check
first if you need to warn them.

`assigneeId` wins if both are supplied.

### Attributing the author

An integration authenticates with ONE key, so by default every issue it files
is authored by that key's member. When the issues actually originate from
different people, send `creatorEmail` and we resolve it the same way:

```json
{
  "title": "Ship the invoice export",
  "creatorEmail": "sandeep@gnanalytica.com",
  "assigneeEmail": "raunak@gnanalytica.com"
}
```

These are two different people and both matter: `creatorEmail` is who raised or
approved the work, `assigneeEmail` is who has to do it. An unrecognised address
falls back to the key's own member rather than failing — attribution is worth
less than the issue landing.

### Idempotent creates

Pass `externalSource` + `externalId` to make `POST /issues` safe to retry:

```json
{
  "title": "Ship the invoice export",
  "externalSource": "standup-ai",
  "externalId": "b3f1c8e2",
  "externalUrl": "https://standup.gnanalytica.com/tasks/b3f1c8e2"
}
```

Passing the same pair twice returns the **original** issue and fires no second
`issue.created`. A new issue returns **201**; a match returns **200**, so you can
tell a create from a de-duplicated retry. `externalUrl` is surfaced on the issue
so a reader can get back to the source record.

Both are per-workspace: `(workspace, externalSource, externalId)` is unique.

### Polling for changes

`GET /issues?updatedSince=<ISO-8601>` returns only issues touched at or after
that instant, so a syncing client makes **one** request per pass instead of one
per tracked issue. Combine it with the cursor to page:

```
GET /api/v1/issues?updatedSince=2026-08-17T09:00:00Z&limit=200
```

Results stay ordered newest-created-first; `updatedSince` is a filter, not a sort.

`PATCH /issues/{id}` accepts the same fields — reassign, move between
departments, reschedule, or attach to a cycle, milestone, feature or parent
task. Send `null` to clear a field; `labelIds` replaces the whole label set.
Ids are validated against the workspace, so a wrong id returns a clear error
instead of linking silently.

### Planning: milestones, features, cycles

`Project → Milestone → Feature → Task` is the roll-up chain; a task can also
attach straight to a milestone. Milestone `status` drives the weekly
green/amber/red review:
`planned | on_track | at_risk | off_track | achieved | missed`.
Feature `status`: `idea | planned | building | shipped | archived`.

```bash
# a dated phase, then a feature under it
curl -X POST https://your-app/api/v1/milestones -H "Authorization: Bearer int_xxx" \
  -H "content-type: application/json" \
  -d '{ "name": "Launch", "projectId": "<id>", "targetDate": "2026-09-30", "status": "on_track" }'

# slip the date and flag the risk
curl -X PATCH https://your-app/api/v1/milestones/<id> -H "Authorization: Bearer int_xxx" \
  -H "content-type: application/json" \
  -d '{ "targetDate": "2026-10-15", "status": "at_risk" }'
```

`GET /milestones?project=<id>` returns each milestone with its feature count
and rolled-up task progress.

### Editing and deleting records

`PATCH` takes only the fields you want to change; anything else is left alone.
Writes are filtered through a per-resource whitelist, so unknown keys are
ignored and `workspaceId` / `id` can never be written.

| Resource    | Writable fields                                                                                     |
| ----------- | --------------------------------------------------------------------------------------------------- |
| `projects`  | `name`, `description`, `tagline`, `url`, `startDate`, `targetDate`, `ownerId`, `strategistId`         |
| `milestones`| `name`, `description`, `targetDate`, `status`, `projectId`                                            |
| `features`  | `title`, `status`, `startDate`, `targetDate`, `milestoneId`, `projectId`, `ownerId`, `pageId`         |
| `cycles`    | `name`, `startDate`, `endDate`                                                                        |
| `labels`    | `name`, `color`                                                                                       |
| `metrics`   | `name`, `unit`, `cadence`, `isNorthStar`, `projectId`                                                 |
| `feedback`  | `title`, `body`, `source`, `status`, `votes`, `contact`, `featureId`, `projectId`                     |
| `content`   | `title`, `channel`, `status`, `url`, `notes`, `publishDate`, `campaignId`, `projectId`, `ownerId`     |
| `org-roles` | `title`, `userId`, `parentId`                                                                         |
| `activities`| `type`, `body`, `dueDate`, `done`, `accountId`, `contactId`, `dealId`, `projectId`                    |
| `status-updates` | `health`, `body`                                                                                 |
| `databases` | `name`, `icon`                                                                                        |
| `page-comments` | `body` (and `resolved` via `PATCH /page-comments/{id}`)                                           |
| `attachments` | `name`                                                                                              |
| members (`/users/{id}`) | `role`, `title`, `entity`, `employment`, `startDate`, `managerId`                         |
| `deals`     | `name`, `stage`, `value`, `entity`, `expectedClose`, `projectId`, `accountId`, `contactId`, `ownerId` |
| `accounts`  | `name`, `website`, `industry`, `type`, `entity`, `ownerId`                                            |
| `contacts`  | `name`, `email`, `title`, `phone`, `lifecycleStage`, `source`, `accountId`, `entity`, `ownerId`       |
| `campaigns` | `name`, `channel`, `status`, `budget`, `reach`, `replies`, `conversions`, `startDate`, `endDate`, `projectId`, `entity`, `ownerId` |
| `invoices`  | `number`, `status`, `amount`, `issueDate`, `dueDate`, `projectId`, `accountId`, `entity`, `ownerId`   |
| `expenses`  | `vendor`, `category`, `amount`, `status`, `spentDate`, `projectId`, `entity`, `ownerId`               |
| `tickets`   | `subject`, `body`, `status`, `priority`, `assigneeId`, `requesterEmail`, `projectId`, `accountId`, `contactId`, `entity` |

```bash
curl -X PATCH https://your-app/api/v1/tickets/<id> \
  -H "Authorization: Bearer int_xxx" -H "content-type: application/json" \
  -d '{ "status": "solved", "priority": "low" }'
```

`DELETE` is permanent for these records. Pages are the exception: `DELETE
/pages/{id}` trashes the page and its sub-pages, recoverable from **/trash**.

### Documents

Page bodies are Markdown on the way in and out. `POST`/`PATCH /pages` accept
`content` as Markdown (headings, bold/italic/code, links, bullet, numbered and
task lists, blockquotes, fenced code blocks, tables, rules) and `GET /pages/{id}`
returns both `markdown` and the raw editor JSON.

`PATCH` replaces the whole body — read the page first, edit the Markdown, and
send the complete document back. Each content edit snapshots the previous
version (throttled to one per 10 minutes, newest 50 kept), so an agent rewrite
is recoverable via `GET/POST /pages/{id}/versions`.

```bash
curl -X PATCH https://your-app/api/v1/pages/<id> \
  -H "Authorization: Bearer int_xxx" -H "content-type: application/json" \
  -d '{ "title": "Rollout plan", "content": "# Rollout plan\n\n- [x] kickoff\n- [ ] launch" }'
```

## Connecting an app (OAuth)

A registered integration can connect itself instead of a human copying an API
key and a webhook secret between two settings screens — the step most often
skipped or mistyped, and the one whose failure is silent.

Authorization-code flow, confidential client. Clients are configured via env
(`OAUTH_CLIENT_STANDUP_ID` / `_SECRET` / `_REDIRECT_URIS`); there is no dynamic
registration. With those unset the OAuth routes accept nothing at all.

1. Send the admin to
   `GET /oauth/authorize?client_id=…&redirect_uri=…&state=…&response_type=code`.
   They approve on a consent screen. Only workspace **admins** can approve.
2. We redirect to `redirect_uri?code=…&state=…`. The code is single-use and
   expires in 2 minutes.
3. `POST /api/oauth/token` with `grant_type=authorization_code`, `code`,
   `client_id`, `client_secret`, `redirect_uri` →

```json
{ "access_token": "int_…", "token_type": "Bearer",
  "workspace": { "id": "…", "name": "…", "slug": "…" } }
```

The access token IS an ordinary workspace API key: same auth, same scoping, and
revoking it from Settings → API cuts access immediately. It is attributed to the
person who approved, so the key list shows who authorised the connection.

An unknown `client_id` or an unregistered `redirect_uri` renders an error on our
side and is **never** redirected back — redirecting an unvalidated callback would
make this an open redirector and leak the code.

Then call `POST /api/v1/webhooks` with the new key to register delivery, and the
connection is complete with nothing pasted by hand.

| Method   | Path                          | Purpose                                       |
| -------- | ----------------------------- | --------------------------------------------- |
| `GET`    | `/oauth/authorize`            | Consent screen (browser; admin only)          |
| `POST`   | `/api/oauth/token`            | Exchange a code for a workspace API key       |
| `GET`    | `/webhooks`                   | List webhooks (secrets never returned)        |
| `POST`   | `/webhooks`                   | Register a webhook; idempotent on `url`       |

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
`project.created`, `page.created`, `page.updated`, `page.deleted` (or subscribe
to all).

Each request carries `X-Internal-Event`, a per-delivery id, and a signature:

```
X-Internal-Event:     issue.updated
X-Internal-Delivery:  <uuid>
X-Internal-Signature: sha256=<hmac>
```

Verify the signature by computing `HMAC_SHA256(secret, rawBody)` (hex) and
comparing — the secret is shown once when you create the webhook.

**Dedupe on `X-Internal-Delivery`.** It is stable across retries of the same
delivery, so it identifies "this event, again" precisely. Do not synthesise a key
from the body: two distinct events can share one in the same millisecond.

Deliveries time out after 5s and are retried up to **3 times** (backoff ~1s then
~4s) on a transport failure or a `5xx`. A `4xx` is never retried — we read it as
"you understood and rejected this". Retries run after the originating request has
completed, so they never delay the user action that produced the event. The last
status is shown in the dashboard.

> `issue.created` fires for **API-created** issues too. If your integration
> creates issues here, do not subscribe to `issue.created` (or `*`) or you will
> receive an echo of your own writes.

### List workspace members

```bash
curl https://your-app/api/v1/users \
  -H "Authorization: Bearer int_xxx"
```

```json
{
  "data": [
    { "id": "…", "name": "Raunak", "email": "raunak@gnanalytica.com",
      "role": "admin", "title": "Full-stack Engineer", "entity": "India",
      "avatarColor": "#6366f1" }
  ],
  "count": 1
}
```

Only members of the key's workspace are returned. `?email=` filters
case-insensitively and is the intended way to map a person to an `assigneeId`.

## MCP

The same surface is available to AI agents via the MCP server in `mcp/` — see
`mcp/README.md`. Point it at this API with an API key and any MCP client
(Claude Desktop, Claude Code) can drive the workspace in natural language.
