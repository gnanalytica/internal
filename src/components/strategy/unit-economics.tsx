"use client";

import { useState } from "react";

import {
  segmentUnitMargin,
  segmentUnitMarginHeavy,
  type PricingModel,
} from "@/lib/pricing";

import { Section } from "./ui";

export function UnitEconomics({ pricingModel }: { pricingModel: PricingModel | null }) {
  const [finalizeRatio, setFinalizeRatio] = useState(2);
  const [heavyShare, setHeavyShare] = useState(10);
  const segments = pricingModel?.segments ?? [];
  const first = segments.map((s) => ({ s, m: segmentUnitMargin(s) })).find((x) => x.m);
  let effective: number | null = null;
  if (first?.m) {
    const heavy = segmentUnitMarginHeavy(first.s)!;
    const caseCost = ((100 - heavyShare) / 100) * first.m.cost + (heavyShare / 100) * heavy.cost;
    effective = Math.max(0, Math.round(((first.m.price - caseCost * finalizeRatio) / first.m.price) * 100));
  }
  return (
    <Section n={5} title="Unit Economics" sub="margin under stress · from pricingModel · packaging → Growth">
      {!segments.length ? (
        <p className="text-xs text-muted-foreground">set a pricing model on this project to derive margins</p>
      ) : (
        <div className="flex flex-wrap items-start gap-6">
          <div className="min-w-72 flex-[1.4] space-y-2.5">
            {segments.map((seg) => {
              const base = segmentUnitMargin(seg);
              if (!base) {
                return (
                  <p key={seg.id} className="text-[11px] text-muted-foreground">
                    {seg.label}: no per-unit price ({seg.model}) — margin derives per deal
                  </p>
                );
              }
              const heavy = segmentUnitMarginHeavy(seg)!;
              return (
                <div key={seg.id}>
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>
                      {seg.label} · {seg.params.pricePerUnit as number}/{pricingModel?.unitLabel ?? "unit"}
                    </span>
                    <b className="tabular-nums">
                      {heavy.marginPct !== base.marginPct ? `${base.marginPct}% → ${heavy.marginPct}%` : `${base.marginPct}%`}
                    </b>
                  </div>
                  <div className="relative mt-1 h-3.5 overflow-hidden rounded-full bg-muted" data-tip="teal = margin kept · amber = heavy-tail erosion">
                    <span className="s-grow absolute inset-y-0 left-0 rounded-full bg-teal-500" style={{ width: `${heavy.marginPct}%` }} />
                    <span className="absolute inset-y-0 bg-amber-500/60" style={{ left: `${heavy.marginPct}%`, width: `${Math.max(0, base.marginPct - heavy.marginPct)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          {first?.m ? (
            <div className="min-w-64 flex-1">
              <label className="flex justify-between text-[10px] text-muted-foreground">
                <span>finalize rate (drafted per finalized)</span>
                <b className="tabular-nums">{finalizeRatio.toFixed(1)}×</b>
              </label>
              <input type="range" min="10" max="60" value={finalizeRatio * 10} className="w-full" onChange={(e) => setFinalizeRatio(Number(e.target.value) / 10)} />
              <label className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                <span>heavy-tail share of cases</span>
                <b className="tabular-nums">{heavyShare}%</b>
              </label>
              <input type="range" min="0" max="40" value={heavyShare} className="w-full" onChange={(e) => setHeavyShare(Number(e.target.value))} />
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">effective margin</span>
                <b className={`ml-auto text-xl tabular-nums ${effective != null && effective >= 75 ? "text-teal-500" : effective != null && effective >= 50 ? "text-amber-500" : "text-red-500"}`}>
                  {effective ?? "—"}%
                </b>
              </div>
              <p className="text-[10px] text-muted-foreground">cost per paid unit = case cost × finalize ratio</p>
            </div>
          ) : null}
        </div>
      )}
    </Section>
  );
}
