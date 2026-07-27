"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CommentComposer } from "@/components/page-comments";
import { useRouter } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import type { Member, PageCommentItem } from "@/lib/types";

/**
 * Notion-style block-anchored comment indicators: a 💬 badge in the right
 * margin of any block that has ≥1 comment, plus an on-demand thread opened via
 * the editor's right-click "Comment" action (the `page:comment` DOM event).
 *
 * Positions are measured from each block's rect relative to `columnRef` (which
 * does not scroll internally), so they stay correct as the page scrolls.
 */
export function PageCommentBadges({
  pageId,
  comments,
  members,
  columnRef,
}: {
  pageId: string;
  comments: PageCommentItem[];
  members: Member[];
  columnRef: React.RefObject<HTMLDivElement | null>;
}) {
  const router = useRouter();
  const [positions, setPositions] = useState<
    { blockId: string; top: number; count: number }[]
  >([]);
  const [openBlock, setOpenBlock] = useState<string | null>(null);
  // Blocks opened on demand (via right-click) that may have no comments yet.
  const extraRef = useRef<Set<string>>(new Set());

  // Group unresolved comments by anchored block.
  const byBlock = new Map<string, PageCommentItem[]>();
  for (const c of comments) {
    if (c.blockId && c.resolvedAt == null) {
      const arr = byBlock.get(c.blockId) ?? [];
      arr.push(c);
      byBlock.set(c.blockId, arr);
    }
  }

  const measure = useCallback(() => {
    const column = columnRef.current;
    if (!column) return;
    const columnTop = column.getBoundingClientRect().top;
    const blockIds = new Set<string>([...byBlock.keys(), ...extraRef.current]);
    const next: { blockId: string; top: number; count: number }[] = [];
    for (const blockId of blockIds) {
      const el = document.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`);
      if (!el) continue;
      const top = el.getBoundingClientRect().top - columnTop;
      next.push({ blockId, top, count: byBlock.get(blockId)?.length ?? 0 });
    }
    next.sort((a, b) => a.top - b.top);
    setPositions(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnRef, comments]);

  // Re-measure after render, on scroll/resize, and when comments change.
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

  // Right-click "Comment" on a block → open its thread popover.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ blockId: string }>).detail;
      if (!detail?.blockId) return;
      extraRef.current.add(detail.blockId);
      measure();
      setOpenBlock(detail.blockId);
    };
    window.addEventListener("page:comment", handler);
    return () => window.removeEventListener("page:comment", handler);
  }, [measure]);

  return (
    <div className="pointer-events-none absolute inset-0">
      {positions.map((p) => (
        <div
          key={p.blockId}
          className="pointer-events-auto absolute right-0 -mr-9"
          style={{ top: p.top }}
        >
          <Popover
            open={openBlock === p.blockId}
            onOpenChange={(open) => {
              setOpenBlock(open ? p.blockId : null);
              if (!open) extraRef.current.delete(p.blockId);
            }}
          >
            <PopoverTrigger
              render={
                <button
                  className="flex items-center gap-0.5 rounded-md border bg-background px-1.5 py-0.5 text-muted-foreground shadow-sm transition-colors hover:text-brand"
                  aria-label={`${p.count} comment${p.count === 1 ? "" : "s"} on this block`}
                />
              }
            >
              <MessageSquare className="size-3.5" />
              {p.count > 0 && <span className="text-[11px] tabular-nums">{p.count}</span>}
            </PopoverTrigger>
            <PopoverContent align="end" side="left" className="w-80 p-3">
              <div className="mb-2 space-y-3">
                {(byBlock.get(p.blockId) ?? []).map((c) => (
                  <div key={c.id} className="text-sm">
                    <div className="mb-0.5 flex items-center gap-2">
                      <span className="text-xs font-medium">
                        {c.author?.name ?? "Unknown"}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDistanceToNowStrict(new Date(c.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed">{c.body}</p>
                  </div>
                ))}
                {(byBlock.get(p.blockId)?.length ?? 0) === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Comment on this block.
                  </p>
                )}
              </div>
              <CommentComposer
                pageId={pageId}
                blockId={p.blockId}
                members={members}
                autoFocus
                compact
                placeholder="Comment on this block…"
                onDone={() => {
                  setOpenBlock(null);
                  router.refresh();
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
      ))}
    </div>
  );
}
