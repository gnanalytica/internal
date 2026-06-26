import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

/** Shimmer placeholder used by route loading.tsx screens. */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} style={style} />;
}
