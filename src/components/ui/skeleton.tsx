import { cn } from "@/lib/utils";

/** Shimmer placeholder used by route loading.tsx screens. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}
