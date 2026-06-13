"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { X } from "lucide-react";

import { SmilePlus } from "lucide-react";

import { UserAvatar } from "@/components/glyphs";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addComment, deleteComment, toggleReaction } from "@/lib/actions";
import { PRIORITY_MAP, STATUS_MAP, type PriorityId, type StatusId } from "@/lib/constants";
import { isMentionToken, mentionKeysForMember } from "@/lib/mentions";
import type { Member, ReactionSummary, TimelineItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const REACTION_EMOJIS = ["👍", "❤️", "🎉", "😄", "🚀", "👀", "✅"];

function describe(
  type: string,
  data: { from?: string | null; to?: string | null } | null,
  members: Member[],
): string {
  const memberName = (id?: string | null) =>
    id ? (members.find((m) => m.id === id)?.name ?? "someone") : "no one";
  switch (type) {
    case "created":
      return "created the issue";
    case "status":
      return `set status to ${STATUS_MAP[data?.to as StatusId]?.label ?? data?.to}`;
    case "priority":
      return `set priority to ${PRIORITY_MAP[data?.to as PriorityId]?.label ?? data?.to}`;
    case "assignee":
      return data?.to ? `assigned ${memberName(data.to)}` : "removed the assignee";
    default:
      return "updated the issue";
  }
}

/** Render comment body with @mentions highlighted. */
function CommentBody({ body, members }: { body: string; members: Member[] }) {
  const parts = body.split(/(@[\w.-]+)/g);
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed">
      {parts.map((p, i) => {
        if (p.startsWith("@") && isMentionToken(p.slice(1), members)) {
          return (
            <span key={i} className="rounded bg-brand/10 px-0.5 font-medium text-brand">
              {p}
            </span>
          );
        }
        return <span key={i}>{p}</span>;
      })}
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

export function IssueTimeline({
  issueId,
  timeline,
  members,
}: {
  issueId: string;
  timeline: TimelineItem[];
  members: Member[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const taRef = useRef<HTMLTextAreaElement>(null);
  // The partial @token currently being typed (null when not mentioning).
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  const suggestions =
    mentionQuery === null
      ? []
      : members
          .filter((m) =>
            mentionQuery === ""
              ? true
              : mentionKeysForMember(m).some((k) => k.startsWith(mentionQuery)),
          )
          .slice(0, 5);

  function react(commentId: string, emoji: string) {
    startTransition(async () => {
      await toggleReaction(commentId, emoji);
      router.refresh();
    });
  }

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setBody(val);
    const caret = e.target.selectionStart ?? val.length;
    const before = val.slice(0, caret);
    const m = before.match(/(?:^|\s)@([\w.-]*)$/);
    setMentionQuery(m ? m[1].toLowerCase() : null);
  }

  function insertMention(member: Member) {
    const ta = taRef.current;
    const caret = ta?.selectionStart ?? body.length;
    const before = body.slice(0, caret).replace(/@([\w.-]*)$/, `@${mentionKeysForMember(member)[0]} `);
    const next = before + body.slice(caret);
    setBody(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      ta?.focus();
      ta?.setSelectionRange(before.length, before.length);
    });
  }

  function submit() {
    if (!body.trim()) return;
    startTransition(async () => {
      await addComment(issueId, body);
      setBody("");
      setMentionQuery(null);
      router.refresh();
    });
  }

  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Activity
      </h3>

      <div className="space-y-3">
        {timeline.map((item) =>
          item.kind === "comment" ? (
            <div key={item.id} className="group flex gap-2.5">
              <UserAvatar
                name={item.author?.name ?? "?"}
                color={item.author?.avatarColor ?? "#94a3b8"}
                className="mt-0.5 size-6 text-[9px]"
              />
              <div className="min-w-0 flex-1 rounded-lg border bg-muted/30 px-3 py-2">
                <div className="mb-0.5 flex items-center gap-2">
                  <span className="text-xs font-medium">{item.author?.name ?? "Unknown"}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDistanceToNowStrict(new Date(item.createdAt), { addSuffix: true })}
                  </span>
                  <button
                    onClick={() =>
                      startTransition(async () => {
                        await deleteComment(item.id, issueId);
                        router.refresh();
                      })
                    }
                    className="ml-auto text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                    aria-label="Delete comment"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <CommentBody body={item.body} members={members} />
                <ReactionBar
                  reactions={item.reactions}
                  onToggle={(emoji) => react(item.id, emoji)}
                />
              </div>
            </div>
          ) : (
            <div key={item.id} className="flex items-center gap-2.5 pl-1 text-xs text-muted-foreground">
              <UserAvatar
                name={item.actor?.name ?? "?"}
                color={item.actor?.avatarColor ?? "#94a3b8"}
                className="size-5 text-[8px]"
              />
              <span>
                <span className="font-medium text-foreground">
                  {item.actor?.name ?? "Someone"}
                </span>{" "}
                {describe(item.type, item.data, members)}
              </span>
              <span className="text-[11px]">
                · {formatDistanceToNowStrict(new Date(item.createdAt), { addSuffix: true })}
              </span>
            </div>
          ),
        )}
        {timeline.length === 0 && (
          <p className="text-xs text-muted-foreground">No activity yet.</p>
        )}
      </div>

      {/* Composer */}
      <div className="relative mt-4 rounded-lg border focus-within:border-brand">
        {suggestions.length > 0 && (
          <div className="absolute bottom-full left-0 z-20 mb-1 w-60 overflow-hidden rounded-lg border bg-popover py-1 shadow-md">
            {suggestions.map((m) => (
              <button
                key={m.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(m);
                }}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-accent"
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
          ref={taRef}
          value={body}
          onChange={onChange}
          onKeyDown={(e) => {
            if (e.key === "Escape" && mentionQuery !== null) {
              e.preventDefault();
              setMentionQuery(null);
              return;
            }
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
          placeholder="Leave a comment… (@ to mention)"
          rows={2}
          className="w-full resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center justify-between border-t px-2 py-1.5">
          <span className="text-[11px] text-muted-foreground">
            <kbd className="rounded bg-muted px-1 py-0.5 font-mono">⌘↵</kbd> to send
          </span>
          <Button size="sm" className="h-7" onClick={submit} disabled={pending || !body.trim()}>
            Comment
          </Button>
        </div>
      </div>
    </div>
  );
}
