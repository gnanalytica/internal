# Page Presence & Cursors (Notion parity, sub-project D) — Design

Date: 2026-07-23
Status: Approved (user chose presence-only over CRDT sync; no new vendors)

## Goal

See who's on a page and which block they're editing, plus a stale-save conflict guard. DB-polling based — no WebSocket infra, no third-party service. Real CRDT sync is the "revisit when it hurts" upgrade; this UI carries over.

## Data model

New table `page_presence`:

- `pageId` uuid → pages cascade, not null
- `userId` uuid → users cascade, not null
- `blockId` text nullable — block containing the user's selection anchor (null = viewing, not editing)
- `lastSeenAt` timestamptz not null default now
- Primary key `(pageId, userId)`; index `(pageId, lastSeenAt)`

Rows are upserted on heartbeat; rows older than 30s are treated as gone (and lazily deleted on read).

## Server actions

- `heartbeatPagePresence(pageId, blockId | null)` → upsert own row, then return other users' fresh rows (joined with user name/image) — one round-trip for both directions.
- `leavePagePresence(pageId)` → delete own row (called on unmount/pagehide via sendBeacon-compatible route or best-effort action).

## Client

- `usePagePresence(pageId, editor)` hook in page-view:
  - Every 3s (and immediately on selection change, throttled to 1/s) call heartbeat with the blockId containing the current selection anchor (walk up to the top-level block's data-block-id; null in read mode).
  - Pauses when `document.visibilityState === 'hidden'`.
  - Returns `[{ userId, name, image, color, blockId }]`; color assigned deterministically from userId hash over a 6-color palette.

## UI

- **Header avatars:** stacked avatar chips of active users (excluding self) next to the page title toolbar, with tooltip "Name — editing/viewing".
- **Block indicators:** for each remote user with a blockId, outline that block (2px left border + faint tint in the user's color) and a small floating name tag at its top-right. Rendered as absolutely-positioned overlays measured from `[data-block-id]` rects (same technique as hover gutter), recomputed on presence updates and window resize/scroll.

## Conflict guard (last-write-wins mitigation)

- `page-view` records `updatedAt` when the page loads. The debounced save sends it along; `updatePage` compares against the DB row's current `updatedAt` — if the DB is newer by more than the client's own last save (i.e., someone else wrote), the save still applies (LWW) but the action returns `{ conflict: true }` and the client shows a warning toast: "Someone else edited this page — check recent changes." Version history (sub-project C) is the recovery path.
- Additionally, when presence shows another user editing (blockId non-null) the header shows a subtle "N others editing" amber dot.

## Testing
- Unit: color assignment + staleness filter helpers (pure).
- Manual/browser: two sessions (normal + incognito or second account) showing mutual presence, block outlines moving, conflict toast on interleaved saves.
