import type { Label } from "@/lib/types";

/** Compact colored label chips with a "+N" overflow. */
export function LabelChips({ labels, max = 3 }: { labels: Label[]; max?: number }) {
  if (!labels.length) return null;
  const shown = labels.slice(0, max);
  return (
    <span className="flex shrink-0 items-center gap-1">
      {shown.map((l) => (
        <span
          key={l.id}
          className="flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium"
          style={{ backgroundColor: `${l.color}1a`, color: l.color }}
        >
          <span className="size-1.5 rounded-full" style={{ backgroundColor: l.color }} />
          {l.name}
        </span>
      ))}
      {labels.length > max && (
        <span className="text-[10px] text-muted-foreground">+{labels.length - max}</span>
      )}
    </span>
  );
}
