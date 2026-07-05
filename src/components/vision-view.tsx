"use client";

import { Compass } from "lucide-react";

import { Topbar } from "@/components/topbar";

/**
 * A product's Vision tab — its market, positioning, desirability and GTM story.
 * Rendered as a placeholder until a product's vision is built; we don't
 * fabricate market data per product.
 */
export function VisionView({
  projectName,
  projectId,
}: {
  projectName: string;
  projectId: string;
  productKey: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <Topbar breadcrumb={[{ label: projectName, href: `/projects/${projectId}` }, { label: "Strategy" }]} />
      <div className="scrollbar-thin flex-1 overflow-y-auto p-4">
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
      </div>
    </div>
  );
}
