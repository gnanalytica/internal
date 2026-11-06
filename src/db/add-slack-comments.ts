import { config } from "dotenv";
config({ path: ".env.local" });
import { sql } from "drizzle-orm";
import { db } from "./index";

/**
 * Idempotent: the table Slack thread sync needs (src/lib/slack/handlers/thread-sync.ts)
 * — the same change `pnpm db:push` would make from schema.ts. Every statement
 * is IF NOT EXISTS and runs on its own (the Neon HTTP driver has no
 * transactions), so it is safe to run twice or to re-run after a failure.
 *
 * Purely additive: nothing outside the Slack handlers reads it except the
 * task timeline, which tolerates its absence. Run it after add-slack.ts.
 *
 *     pnpm tsx --env-file=.env.local src/db/add-slack-comments.ts
 */
async function main() {
  await db.execute(sql`
    create table if not exists slack_comments (
      comment_id uuid primary key references comments(id) on delete cascade,
      workspace_id uuid not null references workspaces(id) on delete cascade,
      issue_id uuid not null references issues(id) on delete cascade,
      slack_channel_id text not null,
      slack_thread_ts text not null,
      slack_ts text not null,
      slack_user_id text,
      author_name text,
      created_at timestamptz not null default now()
    )`);
  await db.execute(
    sql`create unique index if not exists slack_comments_message_issue_idx on slack_comments (slack_channel_id, slack_ts, issue_id)`,
  );
  console.log("slack_comments  created");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
