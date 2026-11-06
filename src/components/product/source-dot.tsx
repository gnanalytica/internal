import { sourceBucket } from "@/lib/product-roadmap";
import { tone } from "@/lib/tones";
import { cn } from "@/lib/utils";

/** Where a piece of feedback came from, as a dot in its bucket's hue. */
export function SourceDot({ source, className }: { source: string; className?: string }) {
  const b = sourceBucket(source);
  return (
    <span title={b.label} className={cn("inline-block size-[7px] shrink-0 translate-y-[-1px] rounded-full", tone(b.tone).dot, className)}>
      <span className="sr-only">{b.label}</span>
    </span>
  );
}
