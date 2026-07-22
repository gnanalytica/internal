# Page Comments (Notion parity, sub-project B) — Design

Date: 2026-07-23
Status: Approved

## Goal

Comment threads on wiki/doc pages, including Notion-style block-anchored margin indicators. Reuses the issue-comment look and the existing block-id + scroll-flash infrastructure.

## Data model

New table `page_comments` (issue `comments` stays untouched):

- `id` uuid pk default random
- `workspaceId` uuid → workspaces cascade
- `pageId` uuid → pages cascade, not null
- `parentId` uuid nullable (self-reference; one level of threading — replies cannot have replies)
- `blockId` text nullable — the editor block's `data-block-id` this comment anchors to; null = page-level comment
- `authorId` uuid → users set-null
- `body` text not null
- `resolvedAt` timestamptz nullable
- `createdAt` timestamptz default now
- Indexes: `(pageId)`, `(pageId, blockId)`

Reactions: new `page_comment_reactions` table mirroring `comment_reactions` (pageCommentId, userId, emoji, unique triple). (Separate table keeps FKs honest; generalizing the old table is a "revisit when it hurts" seam.)

Schema deploy: `db:push --force` (Neon HTTP, no transactions; idempotent scripts only).

## Server actions

- `createPageComment(pageId, body, { blockId?, parentId? })` — inserts; notifies page creator + @-mentioned users via existing notifications pattern (type "commented").
- `deletePageComment(id)` — author-only hard delete (replies cascade via parentId cleanup in the action).
- `resolvePageComment(id)` / `reopenPageComment(id)` — toggles resolvedAt on a root comment.
- `togglePageCommentReaction(commentId, emoji)`.
- Page load (`page-view` server component) fetches comments + authors + reactions in one query set.

## UI

### Comments panel (page sidebar area)
- New "Comments" section on `page-view.tsx` beside/below the existing Linked tasks + Backlinks sections: root comments newest-first, each with author avatar/name/relative time, body (plain text with @-mention highlighting like issue comments), reactions row, Reply input (one level), Resolve/Reopen, Delete (own comments).
- Composer at top: textarea + submit (Cmd+Enter).
- Resolved comments collapse under a "Resolved (N)" toggle.

### Block-anchored margin indicators
- Blocks having ≥1 unresolved comment show a 💬 badge with count in the right margin (absolutely positioned via the same block-rect measuring approach as the left hover gutter; recomputed on scroll/update via a data map keyed by blockId).
- Clicking the badge opens a popover with that block's thread (same components as the panel, filtered to the blockId).
- Anchored comments in the panel show a "→ block" chip; clicking scrolls to the block and flashes it (existing `#b-` mechanism, in-page variant).
- New entry point: right-click context menu → "Comment" (uses the clicked block's blockId; opens the popover with composer focused). Blocks without a blockId yet get one assigned on demand (BlockId extension already assigns ids to top-level blocks).

### Orphans
- If a block is deleted, its comments remain visible in the panel with a muted "(original block deleted)" note (anchor lookup fails → fallback rendering). No DB cleanup.

## Testing
- Unit: action input validation helpers if extracted; orphan fallback logic as a pure helper if practical.
- Manual/browser: create, reply, resolve, react, anchored badge, context-menu comment, orphan behavior.
