#!/bin/bash
# SessionStart hook for Claude Code on the web: install dependencies so tests,
# linters and the type-checker work in remote sessions. Idempotent; the
# container state is cached after it completes.
set -euo pipefail

# Only run in Claude Code on the web (remote) sessions — local setups are left
# untouched.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

echo "[session-start] installing dependencies…"
npm install

# Optional live-rollout: sync the DB schema and seed the Gnanalytica hub.
# Opt-in and guarded so a normal session only installs deps. Enable by setting
# CLAUDE_DB_SETUP=1 (and a DATABASE_URL) in the environment configuration.
# Best-effort: failures never block the session. NOTE: db:push --force may apply
# destructive schema changes — only enable against a database you can rebuild.
if [ "${CLAUDE_DB_SETUP:-}" = "1" ] && [ -n "${DATABASE_URL:-}" ]; then
  echo "[session-start] CLAUDE_DB_SETUP=1 → syncing schema + seeding…"
  npm run db:push -- --force || echo "[session-start] db:push failed (continuing)"
  npx tsx src/db/seed-crm.ts || echo "[session-start] db:seed-crm failed (continuing)"
fi

echo "[session-start] done."
