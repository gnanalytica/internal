"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toggleSubscription } from "@/lib/actions";
import { cn } from "@/lib/utils";

/**
 * Follow a task or page.
 *
 * Distinct from the star next to it: a favourite is a shortcut, this is an
 * inbox subscription. Commenting, being assigned or being mentioned turns it on
 * for you automatically — this is how you opt into something nobody handed you,
 * or out of something you no longer care about.
 */
export function WatchButton({
  kind,
  targetId,
  initial,
}: {
  kind: "issue" | "page" | "project";
  targetId: string;
  initial: boolean;
}) {
  const router = useRouter();
  const [watching, setWatching] = useState(initial);
  const [, startTransition] = useTransition();

  function toggle() {
    const next = !watching;
    setWatching(next); // optimistic
    startTransition(async () => {
      const result = await toggleSubscription(kind, targetId);
      setWatching(result);
      router.refresh();
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7"
      onClick={toggle}
      aria-label={watching ? "Stop watching" : "Watch"}
      title={watching ? "Watching — you'll get updates" : "Watch for updates"}
    >
      {watching ? (
        <Bell className={cn("size-4 fill-brand/20 text-brand")} />
      ) : (
        <BellOff className="size-4 text-muted-foreground" />
      )}
    </Button>
  );
}
