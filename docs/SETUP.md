# Products in `~/code` — what they are & how to set each up

An index of the repos under `/Users/sandeeppvn/code/`. Each entry has a one-line
description, stack, the exact local-run commands, and what credentials/services
it needs.

| Repo | What it is | Stack | Deploy |
| --- | --- | --- | --- |
| **notion** | Notion + Linear internal tool (this app) | Next.js 16 · Neon · Drizzle | Vercel + Neon |
| **healthytica** | AI blood-biomarker health intelligence | Next.js 15 · Supabase · TS engine | Vercel + Supabase |
| **valytica** | AI valuation management (Indian valuers) | Next.js 16 · Supabase | Vercel (`bom1`) + Supabase |
| **standup-ai** | Autonomous standup bot (Meet → Slack/Linear) | FastAPI · React/Vite · AWS | EC2 + S3 + CloudFront |
| **ai-workshop** | SaaS LMS for a 30-day AI workshop | Next.js 15 · Supabase (RLS) | Vercel + Supabase |
| **airdosa** | Marketing site ("dosas by drone") | Next.js 16 | Vercel |
| **valytica-old** | Legacy microservices valuation platform | Docker Compose · Terraform | AWS |

Common prerequisites: Node ≥ 20 (22 for some), `pnpm`/`npm`, and for a few:
Docker, the Supabase CLI, `uv` (Python), Terraform.

---

## notion — Notion + Linear internal tool

The repo holds **three** deliverables.

### Web app (root) — Next.js 16, Neon, Drizzle

```bash
npm install
cp .env.example .env.local        # fill DATABASE_URL + Neon Auth vars
npm run db:push                   # create tables
npm run db:seed                   # optional: demo data
npm run dev                       # http://localhost:3000
```

Env: `DATABASE_URL` (Neon Postgres), `NEON_AUTH_BASE_URL`,
`NEON_AUTH_COOKIE_SECRET`. Optional: `ANTHROPIC_API_KEY` (AI features),
`BLOB_READ_WRITE_TOKEN` (attachments), `NEXT_PUBLIC_APP_URL`.

Useful scripts: `npm run test`, `npm run db:studio`, `npm run db:seed`,
`npm run db:reset` (wipe all data, no seed). Deploys to Vercel on push to `main`
(`internal.gnanalytica.com`). REST API + webhooks: `docs/API.md`.

### Mobile (`mobile/`) — Expo Android WebView shell

```bash
cd mobile
npm install
npx expo install --fix
npx expo start                    # press 'a' for an emulator / scan in Expo Go
```

Build an APK (cloud, no Android Studio): `npm i -g eas-cli && eas login &&
eas init && eas build -p android --profile preview`. Target URL is in
`mobile/app.json → expo.extra.appUrl`.

### MCP server (`mcp/`) — agent tools over the REST API

```bash
cd mcp
npm install
INTERNAL_API_KEY=int_xxx \
INTERNAL_API_URL=https://internal.gnanalytica.com/api/v1 \
node server.mjs
```

Get the key from **Settings → API & MCP**. Add to any MCP client (Claude
Desktop/Code) — see `mcp/README.md`.

---

## healthytica — AI health intelligence (pnpm monorepo)

```bash
pnpm install
supabase start                    # local Supabase (needs Docker)
cp apps/web/.env.example apps/web/.env.local
pnpm dev                          # http://localhost:3000
```

Layout: `packages/engine/` (pure-TS clinical core), `apps/web/` (Next.js 15),
`supabase/` (schema + RLS + migrations).
Env (`apps/web/.env.local`): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (from
`supabase start`), optional `AI_GATEWAY_API_KEY` (Claude extraction).
Checks: `pnpm test`, `pnpm typecheck`, `pnpm build`. Deploy: Vercel (root
`apps/web`) + Supabase migrations.

---

## valytica — AI valuation management

```bash
pnpm install
pnpm dev                          # http://localhost:3000
pnpm exec tsc --noEmit && pnpm build   # pre-push checks
```

Stack: Next.js 16 + Supabase, Vercel Functions in Mumbai (`bom1`). Env
(`.env.example`): optional `AI_GATEWAY_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY`
(Gemini), captcha keys, `MAPPLS_*` / `GOOGLE_GEOCODING_KEY` (geocoding),
`NEXT_PUBLIC_MAPPLS_KEY` / `NEXT_PUBLIC_GOOGLE_MAPS_KEY`. Migrations in
`supabase/migrations/` apply on merge to `main`. Has a `mobile/` subdir
(`pnpm mobile:start`, `pnpm mobile:build:prod`, `pnpm mobile:submit`).

---

## standup-ai — autonomous standup bot + dashboard

```bash
make install                      # uv sync (backend + bot)
cp .env.example backend/.env
make backend                      # FastAPI on http://localhost:8000
cd frontend && npm install && npm run dev   # dashboard on http://localhost:5173
make fake-transcript              # run with a fake transcript
```

Backend `backend/.env`: `LLM_PROVIDER` (`gemini`|`anthropic`),
`GEMINI_API_KEY` / `ANTHROPIC_API_KEY`, `RECALL_API_KEY` +
`RECALL_WEBHOOK_SECRET` (bot), `LINEAR_API_KEY` + `LINEAR_TEAM_ID`,
`SLACK_WEBHOOK_URL`, `BACKEND_PUBLIC_URL`, `STORAGE_BACKEND` (`local`|`s3`).
Deploy: `./deploy/push.sh` (rsync → EC2, restart systemd); infra in `infra/`
(Terraform). Dashboard: `standup.gnanalytica.com`.

---

## ai-workshop — SaaS LMS (30-day AI workshop)

```bash
cd web
pnpm install
cp .env.example .env.local
pnpm dev                          # http://localhost:3000
```

Apply DB schema + seed (set `DB_URL` to your Supabase Postgres):

```bash
export DB_URL='postgres://postgres:<pw>@<host>:5432/postgres'
for f in supabase/migrations/000{1..9}_*.sql; do psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done
psql "$DB_URL" -f supabase/seed/cohort.sql
```

Env (`web/.env.example`): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`EDGE_FUNCTION_SHARED_SECRET`, `RESEND_API_KEY`, `NEXT_PUBLIC_SITE_URL`.
Checks: `pnpm typecheck && pnpm lint && pnpm test && pnpm e2e && pnpm build`.
Deploy: Vercel (root `web/`) + Supabase. Content in `web/content/day-01..30.mdx`.

---

## airdosa — marketing site

```bash
npm install
npm run dev                       # http://localhost:3000
```

No env. Plain Next.js 16 — deploy to Vercel.

---

## valytica-old — legacy microservices (Docker)

```bash
cp .env.example .env
make install
make up                           # frontend :3000 · API gateway :8000/docs · logs :8080
```

Other: `make down`, `make restart`, `make logs`, `make reset` (full reset),
`make deploy ENV=dev|prod` (Terraform + GitHub Actions). Microservices:
api-gateway, case-service, document-service, ai-service.
