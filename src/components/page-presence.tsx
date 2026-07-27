"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { UserAvatar } from "@/components/glyphs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { heartbeatPagePresence, leavePagePresence } from "@/lib/actions";
import type { PresenceUser } from "@/lib/types";

/** Read the top-level block id containing the caret, or null when not editing. */
function currentBlockId(): string | null {
  const sel = typeof window !== "undefined" ? window.getSelection() : null;
  if (!sel || sel.rangeCount === 0) return null;
  const node = sel.anchorNode;
  if (!node) return null;
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement);
  // Only report presence when the selection is inside an editor surface.
  if (!el?.closest(".tiptap")) return null;
  return el.closest("[data-block-id]")?.getAttribute("data-block-id") ?? null;
}

/**
 * DB-polling presence: heartbeat every 3s (and on selection change, throttled
 * to 1/s), pause when the tab is hidden, and clean up on unmount. Returns the
 * other users currently active on the page.
 */
export function usePagePresence(pageId: string): PresenceUser[] {
  const [others, setOthers] = useState<PresenceUser[]>([]);
  const lastBeat = useRef(0);

  const beat = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    lastBeat.current = Date.now();
    try {
      const rows = await heartbeatPagePresence(pageId, currentBlockId());
      setOthers(rows);
    } catch {
      // Best-effort; a failed heartbeat just skips this tick.
    }
  }, [pageId]);

  useEffect(() => {
    // beat() awaits a network round-trip before setState, so there is no
    // synchronous render cascade despite what the static rule assumes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void beat();
    const interval = setInterval(() => void beat(), 3000);

    // Selection changes bump presence, throttled to at most once per second.
    const onSelection = () => {
      if (Date.now() - lastBeat.current >= 1000) void beat();
    };
    document.addEventListener("selectionchange", onSelection);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void beat();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onLeave = () => void leavePagePresence(pageId);
    window.addEventListener("pagehide", onLeave);

    return () => {
      clearInterval(interval);
      document.removeEventListener("selectionchange", onSelection);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onLeave);
      void leavePagePresence(pageId);
    };
  }, [beat, pageId]);

  return others;
}

/** Stacked avatar chips of active users, shown in the page header toolbar. */
export function PagePresenceAvatars({ others }: { others: PresenceUser[] }) {
  if (others.length === 0) return null;
  const editing = others.filter((o) => o.blockId != null).length;
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-1.5">
        {others.slice(0, 4).map((o) => (
          <TooltipProvider key={o.userId}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <span
                    className="rounded-full ring-2 ring-background"
                    style={{ boxShadow: `0 0 0 1.5px ${o.color}` }}
                  />
                }
              >
                <UserAvatar name={o.name} color={o.avatarColor} className="size-6 text-[9px]" />
              </TooltipTrigger>
              <TooltipContent>
                {o.name} — {o.blockId ? "editing" : "viewing"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
        {others.length > 4 && (
          <span className="grid size-6 place-items-center rounded-full bg-muted text-[9px] ring-2 ring-background">
            +{others.length - 4}
          </span>
        )}
      </div>
      {editing > 0 && (
        <span
          className="flex items-center gap-1 text-[11px] text-amber-600"
          title={`${editing} other${editing === 1 ? "" : "s"} editing`}
        >
          <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
          {editing} editing
        </span>
      )}
    </div>
  );
}

/** Absolutely-positioned block outlines + name tags for remote users. */
export function PagePresenceOverlay({
  others,
  columnRef,
}: {
  others: PresenceUser[];
  columnRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [boxes, setBoxes] = useState<
    { userId: string; name: string; color: string; top: number; height: number }[]
  >([]);

  const active = others.filter((o) => o.blockId != null);

  const measure = useCallback(() => {
    const column = columnRef.current;
    if (!column) return;
    const columnTop = column.getBoundingClientRect().top;
    const next: typeof boxes = [];
    for (const o of active) {
      const el = document.querySelector<HTMLElement>(`[data-block-id="${o.blockId}"]`);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      next.push({
        userId: o.userId,
        name: o.name,
        color: o.color,
        top: rect.top - columnTop,
        height: rect.height,
      });
    }
    setBoxes(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnRef, others]);

  useEffect(() => {
    const raf = requestAnimationFrame(measure);
    const onScrollResize = () => measure();
    window.addEventListener("resize", onScrollResize);
    const scroller = columnRef.current?.closest(".scrollbar-thin");
    scroller?.addEventListener("scroll", onScrollResize, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onScrollResize);
      scroller?.removeEventListener("scroll", onScrollResize);
    };
  }, [measure, columnRef]);

  return (
    <div className="pointer-events-none absolute inset-0">
      {boxes.map((b) => (
        <div
          key={b.userId}
          className="absolute left-0 right-0"
          style={{ top: b.top, height: b.height }}
        >
          <div
            className="absolute inset-y-0 -left-3 w-0.5 rounded"
            style={{ backgroundColor: b.color }}
          />
          <div className="absolute inset-0 rounded" style={{ backgroundColor: `${b.color}10` }} />
          <span
            className="absolute -top-2 right-0 rounded px-1 py-0.5 text-[9px] font-medium text-white"
            style={{ backgroundColor: b.color }}
          >
            {b.name}
          </span>
        </div>
      ))}
    </div>
  );
}
