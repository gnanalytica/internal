# Slack

Internal's Slack app ("Internal") posts what happens in the workspace to the
channels that ask for it, threads later events for the same record under the
first post (as Linear does), and lets people act on tasks from Slack.

## Setup (a Slack workspace admin, once)

0. **Database first.** Run the apply script against production *before* this
   code deploys — every read of `users` names the new `slack_user_id` column:

   ```bash
   pnpm tsx --env-file=.env.local src/db/add-slack.mts
   ```

   It is idempotent (all `IF NOT EXISTS`), so running it twice is harmless.

1. **Create the app from the manifest.** At <https://api.slack.com/apps> choose
   **Create New App → From a manifest**, pick the workspace, and paste
   [`slack/manifest.json`](../slack/manifest.json). It sets the bot user, scopes,
   events, interactivity, the `/internal` command, the "Create task" message
   shortcut and the `internal.gnanalytica.com` unfurl domain, all pointing at
   `https://internal.gnanalytica.com/api/slack/webhook`.
2. **Install it.** *OAuth & Permissions → Install to Workspace*, and allow.
3. **Copy the credentials into Vercel** (project `gnanalytica/internal`,
   Production — and Preview if you want previews to post):
   - `SLACK_BOT_TOKEN` — *OAuth & Permissions → Bot User OAuth Token* (`xoxb-…`)
   - `SLACK_SIGNING_SECRET` — *Basic Information → App Credentials → Signing Secret*

   `DATABASE_URL` is already set; the bot keeps its state (dedupe, locks) in
   the same Neon database.
4. **Redeploy**, then open *Event Subscriptions* in the Slack app and check the
   request URL shows **Verified** (Slack re-checks it after a deploy; click
   *Retry* if it was saved before the env vars were live).
5. **Invite the bot** to each channel that should hear from Internal
   (`/invite @Internal`), then add the channel in **Settings › Slack** — the
   two presets set up `#engineering` and `#product-and-business`.
6. **Link accounts.** Each person clicks **Link my Slack account** in Settings ›
   Slack. Anyone whose Slack email matches their Internal email is linked
   automatically the first time they click a button in Slack; anyone else
   enters their Slack email or member ID there and confirms from a DM.

Without `SLACK_BOT_TOKEN` and `SLACK_SIGNING_SECRET` everything Slack is a
no-op and `/api/slack/webhook` answers 503.

## What gets posted

Channel rules (Settings › Slack, admins) choose events per channel, optionally
for one project:

| Group | Events |
| --- | --- |
| Engineering | `issue.created`, `issue.status_changed`, `issue.assigned`, `issue.commented` |
| Sales | `deal.won`, `prospect.stage_changed` (optionally from a stage on, e.g. Demo done) |
| Customer Success | `ticket.created` |
| Product | `feedback.created` |
| Marketing | `content.published` |

The first event for a record in a channel posts a card (linked title, what
happened, key fields; tasks get **Assign to me**, a **status** select and
**Open**). Later events reply in that card's thread and refresh the card.

## Code

```
src/app/api/slack/webhook/route.ts   the one URL Slack calls (events, interactivity, commands)
src/lib/slack/
  config.ts          isSlackConfigured(), appUrl()
  bot.ts             the Chat SDK instance; registers every handlers/* module
  types.ts           SlackBot — the type handler modules register on
  events.ts          event catalogue, rule matching, presets (pure)
  cards.ts           card fields, event lines, status select, the card (pure)
  records.ts         reads a record as a card snapshot
  notify.ts          emitSlackEvent() — outbound, fire-and-forget in after()
  users.ts           Slack user ↔ app user (email match, manual link)
  settings-*.ts      Settings › Slack data and server actions
  rule-draft.ts      the rule editor's state (pure)
  handlers/
    notifications-actions.ts   Assign to me, status select, account-link confirm
    commands.ts                /internal, modals, "Create task" shortcut   (next)
    unfurl.ts                  link_shared previews                        (next)
    thread-sync.ts             thread replies ↔ comments                   (next)
    ai.ts                      the AI bot                                  (next)
src/db/add-slack.mts                 apply script (ES module: its state-pg import is ESM-only)
slack/manifest.json                  the Slack app
```

Each `handlers/*.ts` exports `register(bot: SlackBot)`, which only attaches
handlers. Handlers run with no session: resolve the person with
`appUserForSlack(bot, workspaceId, slackUserId)` and write through the
session-less functions in `src/lib/api/*-ops.ts`, which expire the same cache
tags the web app's actions do.
