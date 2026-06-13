# Acme — a combined Notion + Linear workspace

A self-built, Vercel-friendly internal tool that fuses **Notion-style docs** with
**Linear-style issue tracking** in one workspace. Built from scratch (no Huly/Plane)
to run on **Vercel free tier + Neon Postgres**.

## Stack

- **Next.js 16** (App Router, React 19, Server Actions)
- **Neon** serverless Postgres + **Drizzle ORM**
- **shadcn/ui** (Base UI) + Tailwind v4, **Geist** font
- **TipTap** block editor with Notion-style slash commands
- **dnd-kit** for the Kanban board

## Features (v1)

- **Pages** — nested page tree, block editor, slash commands (`/`), emoji icons, autosave
- **Issues** — list grouped by status + drag-and-drop Kanban board
- Issue properties: status, priority, assignee, project, labels (all inline-editable)
- **Projects** with per-project issue identifiers (e.g. `ENG-12`)
- **Issue ↔ Page linking** (bidirectional)
- Minimal demo session with a user switcher (real auth is the next step)

## Local development

```bash
npm install
cp .env.example .env.local   # set DATABASE_URL to your Neon connection string
npm run db:push              # create tables
npm run db:seed              # seed a demo workspace
npm run dev
```

Open http://localhost:3000.

## Scripts

- `npm run db:push` — sync the Drizzle schema to Neon
- `npm run db:seed` — reset + seed demo data
- `npm run db:studio` — open Drizzle Studio

## Deployment (Vercel)

1. Set `DATABASE_URL` in the Vercel project's environment variables.
2. Deploy (`vercel --prod`). The schema must already be pushed to the Neon database.

## Not yet built (intentionally deferred)

Real authentication, realtime multiplayer, cycles/sprints, initiatives,
Notion-style database views, GitHub/Slack integration, multi-tenancy.
