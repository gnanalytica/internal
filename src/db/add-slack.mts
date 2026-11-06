import { config } from "dotenv";
config({ path: ".env.local" });
import { postgresSchemaStatements } from "@chat-adapter/state-pg";
import { sql } from "drizzle-orm";
import { db } from "./index";

/**
 * Idempotent: the tables and column the Slack integration needs (src/lib/slack).
 * Same change as `pnpm db:push` would make from schema.ts, plus the Chat SDK's
 * own state tables, which schema.ts doesn't model. Every statement is
 * IF NOT EXISTS and runs on its own (the Neon HTTP driver has no
 * transactions), so it is safe to run twice or to re-run after a failure.
 *
 * Run it BEFORE the code that reads `users.slack_user_id` deploys: every
 * `select().from(users)` names the column.
 *
 *     pnpm tsx --env-file=.env.local src/db/add-slack.mts
 */
async function main() {
  await db.execute(sql`alter table users add column if not exists slack_user_id text`);
  await db.execute(
    sql`create unique index if not exists users_slack_user_id_idx on users (slack_user_id)`,
  );
  console.log("users.slack_user_id  added");

  await db.execute(sql`
    create table if not exists slack_channel_rules (
      id uuid primary key default gen_random_uuid(),
      workspace_id uuid not null references workspaces(id) on delete cascade,
      slack_channel_id text not null,
      slack_channel_name text not null,
      project_id uuid references projects(id) on delete cascade,
      events text[] not null default '{}'::text[],
      filters jsonb not null default '{}'::jsonb,
      created_by uuid references users(id) on delete set null,
      created_at timestamptz not null default now()
    )`);
  await db.execute(
    sql`create index if not exists slack_channel_rules_ws_idx on slack_channel_rules (workspace_id)`,
  );
  console.log("slack_channel_rules  created");

  await db.execute(sql`
    create table if not exists slack_threads (
      id uuid primary key default gen_random_uuid(),
      workspace_id uuid not null references workspaces(id) on delete cascade,
      record_type text not null,
      record_id text not null,
      slack_channel_id text not null,
      slack_thread_ts text not null,
      created_at timestamptz not null default now()
    )`);
  await db.execute(
    sql`create unique index if not exists slack_threads_record_channel_idx on slack_threads (record_type, record_id, slack_channel_id)`,
  );
  await db.execute(
    sql`create index if not exists slack_threads_channel_ts_idx on slack_threads (slack_channel_id, slack_thread_ts)`,
  );
  console.log("slack_threads  created");

  // The Chat SDK's subscriptions, locks, cache, lists and queues. The bot runs
  // with autoCreateSchema off (src/lib/slack/bot.ts), so these must exist first.
  for (const statement of postgresSchemaStatements) {
    await db.execute(sql.raw(statement));
  }
  console.log(`chat_state_*  created (${postgresSchemaStatements.length} statements)`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
