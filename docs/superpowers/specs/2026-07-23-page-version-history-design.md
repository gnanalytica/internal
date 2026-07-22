# Page Version History (Notion parity, sub-project C) — Design

Date: 2026-07-23
Status: Approved

## Goal

Automatic snapshots of page content with a history panel: browse, preview read-only, restore.

## Data model

New table `page_versions`:

- `id` uuid pk default random
- `workspaceId` uuid → workspaces cascade
- `pageId` uuid → pages cascade, not null
- `title` text not null (title at snapshot time)
- `content` jsonb (TipTap JSON at snapshot time)
- `authorId` uuid → users set-null (who triggered the save)
- `cause` text not null default 'auto' — 'auto' | 'restore' (restore = safety snapshot taken just before restoring)
- `createdAt` timestamptz default now
- Index: `(pageId, createdAt desc)`

## Snapshot policy (inside `updatePage`)

- Only when `patch.content` is present.
- Snapshot the CURRENT row (pre-update values) if the newest version for the page is older than 10 minutes or none exists. This means a burst of debounced saves creates at most one version per 10-minute window, and the version always captures a state the user actually saw.
- Retention: after insert, delete versions beyond the newest 50 for that page (sequential idempotent statements — no transaction, per Neon HTTP constraint; acceptable race for a small team).

## Restore

- `restorePageVersion(versionId)`:
  1. Snapshot current page state with cause 'restore' (so restore is undoable).
  2. Copy version title+content onto the page (recompute contentText, syncReferences, updatedAt).
  3. Revalidate paths.

## UI

- "History" button (Clock icon) in the page-view header toolbar → opens a right-side Sheet/panel:
  - Version list newest-first: relative time, author name, 'restored' badge for cause=restore.
  - Selecting a version renders a read-only `RichEditor` preview of its content in the panel body (editable={false} already supported), with the version's title above.
  - "Restore this version" button with a confirm step (inline "Are you sure? Current state is saved as a version first." + confirm button).
- Current page content marked as "Current" at the top of the list.

## Testing
- Unit: snapshot-policy decision helper (pure: lastVersionAt, now → shouldSnapshot).
- Manual/browser: edits create versions on cadence, preview renders, restore round-trips and creates the safety snapshot, retention prunes (verified via direct query).
