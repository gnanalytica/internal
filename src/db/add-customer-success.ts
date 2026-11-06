import { config } from "dotenv";
config({ path: ".env.local" });
import { sql } from "drizzle-orm";
import { db } from "./index";

/**
 * Idempotent: the columns and table the customer-first Customer Success page
 * reads (src/components/customer-success/):
 *
 * - deals.onboarding — step id → ISO date done, per customer
 * - tickets.deal_id — the customer a request came from (on delete set null)
 * - tickets.via — how it reached us: whatsapp|call|email|visit
 * - support_answers — saved question → answer pairs for the Answers tab
 *
 * Same change as `pnpm db:push` would make from schema.ts; safe to run twice.
 * One statement at a time — the Neon HTTP driver has no transactions.
 *
 *     pnpm tsx --env-file=.env.local src/db/add-customer-success.ts
 */
async function main() {
  await db.execute(sql`alter table deals add column if not exists onboarding jsonb not null default '{}'::jsonb`);
  console.log("deals.onboarding  added");
  await db.execute(sql`alter table tickets add column if not exists deal_id uuid references deals(id) on delete set null`);
  console.log("tickets.deal_id  added");
  await db.execute(sql`alter table tickets add column if not exists via text`);
  console.log("tickets.via  added");
  await db.execute(sql`
    create table if not exists support_answers (
      id uuid primary key default gen_random_uuid(),
      workspace_id uuid not null references workspaces(id) on delete cascade,
      project_id uuid references projects(id) on delete cascade,
      question text not null,
      answer text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  console.log("support_answers  created");
  await db.execute(sql`create index if not exists support_answers_project_idx on support_answers (project_id)`);
  console.log("support_answers_project_idx  created");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
