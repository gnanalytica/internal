"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { AtSign, Bell, CheckCheck, CircleDot, MessageSquare, UserPlus } from "lucide-react";

import { RelativeTime } from "@/components/relative-time";
import { UserAvatar } from "@/components/glyphs";
import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions";
import type { NotificationItem } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Today / Yesterday / This week / Earlier, India time, newest first. */
function groupByDay(items: NotificationItem[]) {
  const day = (d: Date | string) => new Date(new Date(d).getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const today = items.length ? day(new Date()) : "";
  const shift = (n: number) => new Date(Date.parse(`${today}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
  const buckets: { label: string; items: NotificationItem[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "This week", items: [] },
    { label: "Earlier", items: [] },
  ];
  for (const n of items) {
    const d = day(n.createdAt);
    const b = d >= today ? 0 : d === shift(1) ? 1 : d >= shift(6) ? 2 : 3;
    buckets[b].items.push(n);
  }
  return buckets.filter((b) => b.items.length > 0);
}

function typeIcon(type: string) {
  switch (type) {
    case "assigned":
      return <UserPlus className="size-3.5 text-muted-foreground" />;
    case "mentioned":
      return <AtSign className="size-3.5 text-muted-foreground" />;
    case "commented":
      return <MessageSquare className="size-3.5 text-muted-foreground" />;
    case "status":
      return <CircleDot className="size-3.5 text-muted-foreground" />;
    default:
      return <Bell className="size-3.5 text-muted-foreground" />;
  }
}

export function InboxView({ notifications }: { notifications: NotificationItem[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const hasUnread = notifications.some((n) => !n.read);

  function open(n: NotificationItem) {
    startTransition(async () => {
      if (!n.read) await markNotificationRead(n.id);
      if (n.issueId) router.push(`/issues/${n.issueId}`);
      else if (n.pageId) router.push(`/pages/${n.pageId}`);
      else if (n.projectId) router.push(`/projects/${n.projectId}`);
      else router.refresh();
    });
  }

  function markAll() {
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[{ label: "Inbox" }]}
        actions={
          hasUnread ? (
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={markAll}>
              <CheckCheck className="size-3.5" /> Mark all read
            </Button>
          ) : undefined
        }
      />

      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
            <div className="grid size-12 place-items-center rounded-xl border bg-muted/50">
              <Bell className="size-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">You&apos;re all caught up</p>
              <p className="text-xs text-muted-foreground">
                Assignments and comments on your issues show up here.
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
            {groupByDay(notifications).map((g) => (
              <section key={g.label} className="mb-6 last:mb-0">
                <h2 className="mb-2 px-1 text-xs font-medium text-muted-foreground">{g.label}</h2>
                <ul className="overflow-hidden rounded-lg border">
                  {g.items.map((n) => (
                    <li key={n.id} className="border-b border-border-subtle last:border-b-0">
                      <button
                        onClick={() => open(n)}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
                      >
                        <span className="mt-0.5 shrink-0">
                          {n.actor ? (
                            <UserAvatar name={n.actor.name} color={n.actor.avatarColor} className="size-7" />
                          ) : (
                            <span className="grid size-7 place-items-center rounded-full bg-muted">
                              {typeIcon(n.type)}
                            </span>
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "text-ui leading-snug",
                              n.read ? "text-muted-foreground" : "font-medium text-foreground",
                            )}
                          >
                            {n.title}
                          </p>
                          {n.body && (
                            <p className="mt-1 line-clamp-2 text-ui text-muted-foreground">{n.body}</p>
                          )}
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            {typeIcon(n.type)}
                            <RelativeTime date={n.createdAt} />
                          </p>
                        </div>
                        {!n.read && (
                          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
