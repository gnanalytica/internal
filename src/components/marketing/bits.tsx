"use client";

import { channelOf, FORMATS, formatOf, statusOf } from "@/lib/marketing";
import type { ContentItem } from "@/lib/types";
import { tone } from "@/lib/tones";
import { cn } from "@/lib/utils";

/** A content piece as the Marketing views see it; relations aren't needed to draw or edit one. */
export type Piece = ContentItem;

export type PiecePatch = Partial<Pick<Piece, "title" | "channel" | "status" | "url" | "notes" | "format" | "details" | "views" | "clicks" | "ownerId">> & {
  /** ISO timestamp, or null to move the piece back to the ideas. */
  publishDate?: string | null;
};

export const fieldCls = "h-9 w-full min-w-0 rounded-md border bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:h-8";

/** Each channel keeps its hue wherever it appears: the calendar row, the table, the editor. */
export function ChannelDot({ channel, className }: { channel: string | null; className?: string }) {
  const c = channelOf(channel);
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", c ? tone(c.tone).dot : "bg-muted-foreground/40", className)} />;
}

export function StatusChip({ status, className }: { status: string; className?: string }) {
  const s = statusOf(status);
  return (
    <span className={cn("inline-flex h-5 items-center gap-1.5 rounded-full pr-2 pl-1.5 text-xs font-medium whitespace-nowrap", tone(s.tone).chip, className)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", tone(s.tone).dot)} />
      {s.label}
    </span>
  );
}

/** "Article · Blog", or whichever half is known. */
export function formatChannelLabel(p: Pick<Piece, "format" | "channel">): string {
  const f = formatOf(p);
  return [f ? FORMATS[f].label : null, channelOf(p.channel)?.label ?? p.channel].filter(Boolean).join(" · ") || "No format yet";
}

export const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] ?? "";
