"use client";

import { useTransition } from "react";

import { DealBoard } from "@/components/deal-board";
import { moveDeals } from "@/lib/actions";
import { formatMoney } from "@/lib/matrix-format";
import { PROSPECT_KINDS, type ProspectKind } from "@/lib/prospects/schema";
import type { DealWithRelations } from "@/lib/types";
import { Empty } from "./bits";

/** "valuer:IBBI/RV/…" → the record it came from; deals made by hand have none. */
function prospectOf(deal: DealWithRelations): { kind: ProspectKind; id: string } | null {
  const ref = deal.prospectRef ?? "";
  const i = ref.indexOf(":");
  const kind = ref.slice(0, i);
  return i > 0 && (PROSPECT_KINDS as readonly string[]).includes(kind) ? { kind: kind as ProspectKind, id: ref.slice(i + 1) } : null;
}

/**
 * The deals prospects turn into. One opens when a prospect reaches Demo done
 * and follows it to Won or Lost; opening a card opens the prospect behind it.
 */
export function DealsTab({ deals, onOpen }: { deals: DealWithRelations[]; onOpen: (r: { kind: ProspectKind; id: string }) => void }) {
  const [, start] = useTransition();
  const open = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const value = (list: DealWithRelations[]) => list.reduce((s, d) => s + d.value, 0);

  if (deals.length === 0) {
    return (
      <div className="px-3 py-3 sm:px-6 sm:py-5">
        <Empty>No deals yet. A deal opens on its own when a prospect reaches Demo done, and moves with it through Pilot running to Won or Lost.</Empty>
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="shrink-0 px-3 pt-3 text-xs text-muted-foreground sm:px-6">
        {open.length} open · {formatMoney(value(open))} · Won {formatMoney(value(deals.filter((d) => d.stage === "won")))}
      </p>
      <div className="min-h-0 flex-1">
        <DealBoard
          deals={deals}
          persist={(changed) => start(() => void moveDeals(changed))}
          onOpen={(d) => {
            const p = prospectOf(d);
            if (p) onOpen(p);
          }}
        />
      </div>
    </div>
  );
}
