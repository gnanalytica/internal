"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { X } from "lucide-react";

import { UserAvatar } from "@/components/glyphs";
import { Button } from "@/components/ui/button";
import { addComment, deleteComment } from "@/lib/actions";
import { PRIORITY_MAP, STATUS_MAP, type PriorityId, type StatusId } from "@/lib/constants";
import type { Member, TimelineItem } from "@/lib/types";

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
  const names = new Set(
    members.flatMap((m) => [m.name.split(" ")[0].toLowerCase(), m.email.split("@")[0].toLowerCase()]),
  );
  const parts = body.split(/(@[\w]+)/g);
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed">
      {parts.map((p, i) => {
        if (p.startsWith("@") && names.has(p.slice(1).toLowerCase())) {
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

  function submit() {
    if (!body.trim()) return;
    startTransition(async () => {
      await addComment(issueId, body);
      setBody("");
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
      <div className="mt-4 rounded-lg border focus-within:border-brand">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
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
