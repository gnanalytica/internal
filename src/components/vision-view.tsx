"use client";

import { Compass } from "lucide-react";

import { MarketVisionDashboard, type VisionVariant } from "@/components/valytica-market-dashboard";
import { Topbar } from "@/components/topbar";

/**
 * A product's Vision tab — its market, positioning, desirability and GTM story.
 * Valytica (VAL) shows the valuation strategy; Atlas (ATL) shows the feasibility
 * strategy. Other products show a placeholder until their vision is built (we
 * don't fabricate market data per product).
 */
const VARIANT_BY_KEY: Record<string, VisionVariant> = { VAL: "valuation", ATL: "feasibility" };

export function VisionView({
  projectName,
  projectId,
  productKey,
}: {
  projectName: string;
  projectId: string;
  productKey: string;
}) {
  const variant = VARIANT_BY_KEY[productKey];
  return (
    <div className="flex h-full flex-col">
      <Topbar breadcrumb={[{ label: projectName, href: `/projects/${projectId}` }, { label: "Vision" }]} />
      <div className="scrollbar-thin flex-1 overflow-y-auto p-4">
        {variant ? (
          <MarketVisionDashboard variant={variant} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="grid size-12 place-items-center rounded-xl border bg-muted/50">
              <Compass className="size-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">No vision yet</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Market sizing, positioning, desirability and go-to-market for {projectName} will live here.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
