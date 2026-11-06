"use client";

import { TabsList } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/**
 * A tab strip that scrolls sideways instead of overflowing the page.
 *
 * `TabsList` is `inline-flex w-fit`, so seven triggers are ~700px wide and on a
 * phone the last three were simply unreachable — clipped by the `overflow-hidden`
 * main element, with no way to scroll to them. The scrollbar is hidden because
 * the strip is short enough that a visible one costs more than it explains.
 */
export function ScrollTabsList({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className="shrink-0 overflow-x-auto overscroll-x-contain px-4 pt-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <TabsList className={cn("w-max", className)}>{children}</TabsList>
    </div>
  );
}
