import type { Label } from "@/lib/types";

/**
 * Labels as quiet chips: a neutral outline and a colour dot, with a "+N"
 * overflow. Colour stays on the dot so a row of chips doesn't out-shout the
 * title beside it.
 */
export function LabelChips({ labels, max = 3 }: { labels: Label[]; max?: number }) {
  if (!labels.length) return null;
  const shown = labels.slice(0, max);
  return (
    <span className="flex shrink-0 items-center gap-1">
      {shown.map((l) => (
        <span
          key={l.id}
          className="inline-flex h-5 items-center gap-1 rounded-full border px-1.5 text-[11px] text-muted-foreground"
        >
          <span className="size-1.5 rounded-full" style={{ backgroundColor: l.color }} />
          {l.name}
        </span>
      ))}
      {labels.length > max && (
        <span className="text-[11px] tabular-nums text-muted-foreground">+{labels.length - max}</span>
      )}
    </span>
  );
}
