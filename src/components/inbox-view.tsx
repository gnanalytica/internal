"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Bell, CheckCheck, CircleDot, MessageSquare, UserPlus } from "lucide-react";

import { UserAvatar } from "@/components/glyphs";
import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions";
import type { NotificationItem } from "@/lib/types";
import { cn } from "@/lib/utils";

function typeIcon(type: string) {
  switch (type) {
    case "assigned":
      return <UserPlus className="size-4 text-brand" />;
    case "commented":
      return <MessageSquare className="size-4 text-brand" />;
    case "status":
      return <CircleDot className="size-4 text-brand" />;
    default:
      return <Bell className="size-4 text-brand" />;
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
          <div className="mx-auto w-full max-w-2xl divide-y px-2 py-3">
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => open(n)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left hover:bg-accent",
                  !n.read && "bg-brand/[0.04]",
                )}
              >
                <span className="relative mt-0.5 shrink-0">
                  {n.actor ? (
                    <UserAvatar name={n.actor.name} color={n.actor.avatarColor} className="size-7" />
                  ) : (
                    <span className="grid size-7 place-items-center rounded-full bg-muted">
                      {typeIcon(n.type)}
                    </span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {typeIcon(n.type)}
                    <span className="truncate text-sm font-medium">{n.title}</span>
                    {!n.read && <span className="ml-auto size-2 shrink-0 rounded-full bg-brand" />}
                  </div>
                  {n.body && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatDistanceToNowStrict(new Date(n.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
