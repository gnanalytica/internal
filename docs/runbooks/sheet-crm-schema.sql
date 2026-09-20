-- Valytica lead-sheet sync: the schema the Prospects workspace needs.
--
-- Equivalent to `pnpm db:push` for the objects added by PR #141, written to be
-- pasted straight into the Neon SQL Editor (console.neon.tech → your project →
-- SQL Editor) when a terminal is not to hand. It is ADDITIVE and IDEMPOTENT:
-- every statement is IF NOT EXISTS, nothing is dropped, nothing existing is
-- altered in place, and running it twice is a no-op. Safe on a live database.
--
-- Afterwards: Prospects → Sync → "Sync now".
--
-- VERIFIED 2026-09-20 by replaying it against a local PostgreSQL 16 built from
-- the pre-PR schema (48 tables) and seeded with rows, which is the shape the
-- production database is in right now:
--   * run 1 creates all five tables, 28 columns and 13 indexes;
--   * runs 2 and 3 complete with zero errors (idempotent);
--   * existing crm_contacts / crm_accounts rows survive and pick up the
--     defaults (outreach_status = 'not_planned', sheet_duplicate = false);
--   * legacy rows with a NULL external_id coexist rather than colliding on the
--     new unique index, because NULLs are distinct in a Postgres unique index;
--   * re-inserting the same person updates in place — one row, not two — which
--     is what stops a re-sync duplicating all 5,663 people;
--   * a retried Standup AI interaction with the same external_ref is a no-op.

-- ---------- the sheet mirror ----------

CREATE TABLE IF NOT EXISTS "sheet_rows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "sheet_id" text NOT NULL,
  "tab" text NOT NULL,
  "row_key" text NOT NULL,
  "weak_key" boolean DEFAULT false NOT NULL,
  "person_id" text,
  "company_id" text,
  "data" jsonb NOT NULL,
  "row_hash" text NOT NULL,
  "synced_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "sheet_sync_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "sheet_id" text NOT NULL,
  "trigger" text DEFAULT 'cron' NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone,
  "status" text DEFAULT 'running' NOT NULL,
  "summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "error" text
);

CREATE TABLE IF NOT EXISTS "sheet_cell_writes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "tab" text NOT NULL,
  "row_key" text NOT NULL,
  "column" text NOT NULL,
  "old_value" text,
  "new_value" text,
  "status" text NOT NULL,
  "detail" text,
  "actor_id" uuid,
  "written_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ---------- the outreach timeline ----------

CREATE TABLE IF NOT EXISTS "interactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "contact_id" uuid,
  "account_id" uuid,
  "campaign_id" uuid,
  "channel" text NOT NULL,
  "direction" text DEFAULT 'none' NOT NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  "subject" text,
  "body" text,
  "summary" text,
  "source" text DEFAULT 'manual' NOT NULL,
  "external_ref" text,
  "external_url" text,
  "meta" jsonb,
  "actor_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "google_grants" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "scopes" text NOT NULL,
  "refresh_token_enc" text NOT NULL,
  "gmail_history_id" text,
  "gmail_synced_at" timestamp with time zone,
  "calendar_synced_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ---------- typed projections onto the existing CRM tables ----------

ALTER TABLE "crm_contacts"
  ADD COLUMN IF NOT EXISTS "external_source"    text,
  ADD COLUMN IF NOT EXISTS "external_id"        text,
  ADD COLUMN IF NOT EXISTS "city"               text,
  ADD COLUMN IF NOT EXISTS "state"              text,
  ADD COLUMN IF NOT EXISTS "ibbi_reg_no"        text,
  ADD COLUMN IF NOT EXISTS "rvo"                text,
  ADD COLUMN IF NOT EXISTS "phone_e164"         text,
  ADD COLUMN IF NOT EXISTS "priority"           text,
  ADD COLUMN IF NOT EXISTS "opportunity_score"  integer,
  ADD COLUMN IF NOT EXISTS "score_band"         text,
  ADD COLUMN IF NOT EXISTS "research_status"    text,
  ADD COLUMN IF NOT EXISTS "best_first_channel" text,
  ADD COLUMN IF NOT EXISTS "persona"            text,
  ADD COLUMN IF NOT EXISTS "sheet_duplicate"    boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "outreach_status"    text DEFAULT 'not_planned' NOT NULL,
  ADD COLUMN IF NOT EXISTS "last_contacted_at"  timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "last_channel"       text,
  ADD COLUMN IF NOT EXISTS "next_action_at"     timestamp with time zone;

ALTER TABLE "crm_accounts"
  ADD COLUMN IF NOT EXISTS "external_source"      text,
  ADD COLUMN IF NOT EXISTS "external_id"          text,
  ADD COLUMN IF NOT EXISTS "city"                 text,
  ADD COLUMN IF NOT EXISTS "state"                text,
  ADD COLUMN IF NOT EXISTS "ibbi_entity_reg_no"   text,
  ADD COLUMN IF NOT EXISTS "constitution"         text,
  ADD COLUMN IF NOT EXISTS "pnb_category"         text,
  ADD COLUMN IF NOT EXISTS "research_confidence"  text,
  ADD COLUMN IF NOT EXISTS "outreach_status"      text DEFAULT 'not_planned' NOT NULL,
  ADD COLUMN IF NOT EXISTS "last_contacted_at"    timestamp with time zone;

-- ---------- foreign keys ----------
-- Added defensively: a repeat run must not fail on an existing constraint.

DO $$ BEGIN
  ALTER TABLE "sheet_rows" ADD CONSTRAINT "sheet_rows_workspace_id_workspaces_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sheet_sync_runs" ADD CONSTRAINT "sheet_sync_runs_workspace_id_workspaces_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sheet_cell_writes" ADD CONSTRAINT "sheet_cell_writes_workspace_id_workspaces_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sheet_cell_writes" ADD CONSTRAINT "sheet_cell_writes_actor_id_users_id_fk"
    FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "interactions" ADD CONSTRAINT "interactions_workspace_id_workspaces_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "interactions" ADD CONSTRAINT "interactions_contact_id_crm_contacts_id_fk"
    FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "interactions" ADD CONSTRAINT "interactions_account_id_crm_accounts_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "crm_accounts"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "interactions" ADD CONSTRAINT "interactions_campaign_id_campaigns_id_fk"
    FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "interactions" ADD CONSTRAINT "interactions_actor_id_users_id_fk"
    FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "google_grants" ADD CONSTRAINT "google_grants_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- indexes ----------
-- The two unique ones are load-bearing: they are the upsert targets that make
-- a re-sync update a person rather than duplicate them.

CREATE UNIQUE INDEX IF NOT EXISTS "sheet_rows_key_idx"        ON "sheet_rows" ("workspace_id","sheet_id","tab","row_key");
CREATE INDEX        IF NOT EXISTS "sheet_rows_person_idx"     ON "sheet_rows" ("workspace_id","person_id");
CREATE INDEX        IF NOT EXISTS "sheet_rows_company_idx"    ON "sheet_rows" ("workspace_id","company_id");
CREATE INDEX        IF NOT EXISTS "sheet_rows_tab_idx"        ON "sheet_rows" ("workspace_id","tab");
CREATE INDEX        IF NOT EXISTS "sheet_sync_runs_ws_idx"    ON "sheet_sync_runs" ("workspace_id","started_at");
CREATE INDEX        IF NOT EXISTS "sheet_cell_writes_row_idx" ON "sheet_cell_writes" ("workspace_id","tab","row_key");

CREATE INDEX        IF NOT EXISTS "interactions_contact_idx"  ON "interactions" ("contact_id","occurred_at");
CREATE INDEX        IF NOT EXISTS "interactions_account_idx"  ON "interactions" ("account_id","occurred_at");
CREATE INDEX        IF NOT EXISTS "interactions_ws_idx"       ON "interactions" ("workspace_id","occurred_at");
CREATE UNIQUE INDEX IF NOT EXISTS "interactions_external_idx" ON "interactions" ("workspace_id","source","external_ref");

CREATE UNIQUE INDEX IF NOT EXISTS "crm_accounts_external_idx" ON "crm_accounts" ("workspace_id","external_source","external_id");
CREATE UNIQUE INDEX IF NOT EXISTS "crm_contacts_external_idx" ON "crm_contacts" ("workspace_id","external_source","external_id");
CREATE INDEX        IF NOT EXISTS "crm_contacts_ws_status_idx" ON "crm_contacts" ("workspace_id","outreach_status");

-- Confirmation. Expect: five new tables, and the two unique external-id indexes.
SELECT table_name FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name IN ('sheet_rows','sheet_sync_runs','sheet_cell_writes','interactions','google_grants')
 ORDER BY table_name;
