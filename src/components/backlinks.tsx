import Link from "next/link";
import { CircleDot, CornerDownRight, FileText } from "lucide-react";

import type { BacklinkItem } from "@/lib/types";

/** "Referenced by" — incoming entity references from docs and issues. */
export function Backlinks({ items }: { items: BacklinkItem[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <CornerDownRight className="size-3.5" />
        Referenced by
      </h3>
      <div className="space-y-0.5">
        {items.map((b) => (
          <Link
            key={`${b.kind}:${b.id}`}
            href={b.href}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
          >
            {b.kind === "issue" ? (
              <CircleDot className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <FileText className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">{b.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
