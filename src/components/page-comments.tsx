"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, CornerDownRight, RotateCcw, SmilePlus, X } from "lucide-react";

import { RelativeTime } from "@/components/relative-time";
import { UserAvatar } from "@/components/glyphs";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  createPageComment,
  deletePageComment,
  reopenPageComment,
  resolvePageComment,
  togglePageCommentReaction,
} from "@/lib/actions";
import { isMentionToken, mentionKeysForMember } from "@/lib/mentions";
import { useMentionAutocomplete } from "@/lib/use-mention-autocomplete";
import type { Member, PageCommentItem, ReactionSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const REACTION_EMOJIS = ["👍", "❤️", "🎉", "😄", "🚀", "👀", "✅"];

/** Scroll to a block by its data-block-id and flash it (in-page variant of #b-). */
function scrollToBlock(blockId: string) {
  const el = document.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("block-flash");
  setTimeout(() => el.classList.remove("block-flash"), 1600);
}

function CommentBody({ body, members }: { body: string; members: Member[] }) {
  const parts = body.split(/(@[\w.-]+)/g);
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed">
      {parts.map((p, i) =>
        p.startsWith("@") && isMentionToken(p.slice(1), members) ? (
          <span key={i} className="rounded bg-brand/10 px-0.5 font-medium text-brand">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </p>
  );
}

function ReactionBar({
  reactions,
  onToggle,
}: {
  reactions: ReactionSummary[];
  onToggle: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={() => onToggle(r.emoji)}
          className={cn(
            "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors",
            r.reactedByMe
              ? "border-brand/40 bg-brand/10 text-brand"
              : "border-border text-muted-foreground hover:bg-accent",
          )}
        >
          <span>{r.emoji}</span>
          <span className="tabular-nums">{r.count}</span>
        </button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              className="rounded-full border border-transparent px-1 py-0.5 text-muted-foreground opacity-0 hover:bg-accent group-hover:opacity-100"
              aria-label="Add reaction"
            />
          }
        >
          <SmilePlus className="size-3.5" />
        </PopoverTrigger>
        <PopoverContent align="start" className="flex w-auto gap-0.5 p-1">
          {REACTION_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => {
                setOpen(false);
                onToggle(e);
              }}
              className="rounded p-1 text-base hover:bg-accent"
            >
              {e}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Composer with @-mention autocomplete. Submits to the given anchor. */
export function CommentComposer({
  pageId,
  blockId = null,
  parentId = null,
  members,
  autoFocus = false,
  compact = false,
  placeholder = "Add a comment… (@ to mention)",
  onDone,
}: {
  pageId: string;
  blockId?: string | null;
  parentId?: string | null;
  members: Member[];
  autoFocus?: boolean;
  compact?: boolean;
  placeholder?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const mention = useMentionAutocomplete({ members, value: body, onChange: setBody });
  const { textareaRef, suggestions, activeIndex } = mention;



  function submit() {
    if (!body.trim()) return;
    startTransition(async () => {
      await createPageComment(pageId, body, { blockId, parentId });
      setBody("");
      mention.close();
      router.refresh();
      onDone?.();
    });
  }

  return (
    <div className="relative rounded-lg border focus-within:border-brand">
      {suggestions.length > 0 && (
        <div className="absolute bottom-full left-0 z-20 mb-1 w-60 overflow-hidden rounded-lg border bg-popover py-1 shadow-md">
          {suggestions.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                mention.insert(m);
              }}
              onMouseEnter={() => mention.setActiveIndex(i)}
              className={cn(
                "flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm",
                i === activeIndex ? "bg-accent" : "hover:bg-accent/60",
              )}
            >
              <UserAvatar name={m.name} color={m.avatarColor} className="size-5 text-[9px]" />
              <span className="truncate">{m.name}</span>
              <span className="ml-auto truncate text-[11px] text-muted-foreground">
                @{mentionKeysForMember(m)[0]}
              </span>
            </button>
          ))}
        </div>
      )}
      <textarea
        ref={textareaRef}
        autoFocus={autoFocus}
        value={body}
        onChange={mention.handleChange}
        onKeyDown={(e) => {
          // The dropdown takes Enter, Tab, arrows and Escape while it is open;
          // Escape with it closed dismisses the composer instead.
          if (mention.handleKeyDown(e)) return;
          if (e.key === "Escape") {
            onDone?.();
            return;
          }
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
        placeholder={placeholder}
        rows={compact ? 1 : 2}
        className="w-full resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
      />
      <div className="flex items-center justify-between border-t px-2 py-1.5">
        <span className="text-[11px] text-muted-foreground">
          <kbd className="rounded bg-muted px-1 py-0.5 font-mono">⌘↵</kbd> to send
        </span>
        <Button size="sm" className="h-7" onClick={submit} disabled={pending || !body.trim()}>
          {parentId ? "Reply" : "Comment"}
        </Button>
      </div>
    </div>
  );
}

function CommentCard({
  comment,
  pageId,
  members,
  showBlockChip,
}: {
  comment: PageCommentItem;
  pageId: string;
  members: Member[];
  showBlockChip: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [replying, setReplying] = useState(false);
  const resolved = comment.resolvedAt != null;
  const blockExists =
    comment.blockId != null &&
    typeof document !== "undefined" &&
    document.querySelector(`[data-block-id="${comment.blockId}"]`) != null;

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className="group">
      <div className="flex gap-2.5">
        <UserAvatar
          name={comment.author?.name ?? "?"}
          color={comment.author?.avatarColor ?? "#94a3b8"}
          className="mt-0.5 size-6 text-[9px]"
        />
        <div className="min-w-0 flex-1 rounded-lg border bg-muted/30 px-3 py-2">
          <div className="mb-0.5 flex items-center gap-2">
            <span className="text-xs font-medium">{comment.author?.name ?? "Unknown"}</span>
            <span className="text-[11px] text-muted-foreground">
              <RelativeTime date={comment.createdAt} />
            </span>
            {resolved && (
              <span className="rounded bg-emerald-500/10 px-1 text-[10px] font-medium text-emerald-600">
                Resolved
              </span>
            )}
            <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100">
              {resolved ? (
                <button
                  onClick={() => run(() => reopenPageComment(comment.id))}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Reopen"
                  title="Reopen"
                >
                  <RotateCcw className="size-3.5" />
                </button>
              ) : (
                <button
                  onClick={() => run(() => resolvePageComment(comment.id))}
                  className="text-muted-foreground hover:text-emerald-600"
                  aria-label="Resolve"
                  title="Resolve"
                >
                  <Check className="size-3.5" />
                </button>
              )}
              <button
                onClick={() => run(() => deletePageComment(comment.id))}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Delete comment"
                title="Delete (own comments)"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          {showBlockChip && comment.blockId && (
            <button
              onClick={() => blockExists && scrollToBlock(comment.blockId!)}
              disabled={!blockExists}
              className={cn(
                "mb-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px]",
                blockExists
                  ? "bg-brand/10 text-brand hover:bg-brand/20"
                  : "bg-muted text-muted-foreground/70",
              )}
            >
              <CornerDownRight className="size-3" />
              {blockExists ? "block" : "original block deleted"}
            </button>
          )}

          <CommentBody body={comment.body} members={members} />
          <ReactionBar
            reactions={comment.reactions}
            onToggle={(emoji) => run(() => togglePageCommentReaction(comment.id, emoji))}
          />

          {!resolved && (
            <button
              onClick={() => setReplying((v) => !v)}
              className="mt-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Reply
            </button>
          )}
        </div>
      </div>

      {(comment.replies.length > 0 || replying) && (
        <div className="ml-4 mt-2 space-y-2 border-l pl-3">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="group flex gap-2.5">
              <UserAvatar
                name={reply.author?.name ?? "?"}
                color={reply.author?.avatarColor ?? "#94a3b8"}
                className="mt-0.5 size-5 text-[8px]"
              />
              <div className="min-w-0 flex-1 rounded-lg border bg-muted/20 px-2.5 py-1.5">
                <div className="mb-0.5 flex items-center gap-2">
                  <span className="text-xs font-medium">{reply.author?.name ?? "Unknown"}</span>
                  <span className="text-[11px] text-muted-foreground">
                    <RelativeTime date={reply.createdAt} />
                  </span>
                  <button
                    onClick={() => run(() => deletePageComment(reply.id))}
                    className="ml-auto text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                    aria-label="Delete reply"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <CommentBody body={reply.body} members={members} />
                <ReactionBar
                  reactions={reply.reactions}
                  onToggle={(emoji) => run(() => togglePageCommentReaction(reply.id, emoji))}
                />
              </div>
            </div>
          ))}
          {replying && (
            <CommentComposer
              pageId={pageId}
              parentId={comment.id}
              members={members}
              autoFocus
              compact
              placeholder="Reply… (@ to mention)"
              onDone={() => setReplying(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** The Comments section on a page: page-level composer + threaded roots. */
export function PageComments({
  pageId,
  comments,
  members,
}: {
  pageId: string;
  comments: PageCommentItem[];
  members: Member[];
}) {
  const [showResolved, setShowResolved] = useState(false);
  const unresolved = comments.filter((c) => c.resolvedAt == null);
  const resolved = comments.filter((c) => c.resolvedAt != null);

  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Comments {comments.length > 0 && `(${comments.length})`}
      </h3>

      <div className="mb-4">
        <CommentComposer pageId={pageId} members={members} />
      </div>

      {unresolved.length === 0 && resolved.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No comments yet. Start a thread, or right-click a block to comment on it.
        </p>
      ) : (
        <div className="space-y-4">
          {unresolved.map((c) => (
            <CommentCard
              key={c.id}
              comment={c}
              pageId={pageId}
              members={members}
              showBlockChip
            />
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowResolved((v) => !v)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {showResolved ? "Hide" : "Show"} resolved ({resolved.length})
          </button>
          {showResolved && (
            <div className="mt-3 space-y-4 opacity-70">
              {resolved.map((c) => (
                <CommentCard
                  key={c.id}
                  comment={c}
                  pageId={pageId}
                  members={members}
                  showBlockChip
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
