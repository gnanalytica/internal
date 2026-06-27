"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Loader2, Plus, X } from "lucide-react";

import { FeatureTimeline } from "@/components/feature-timeline";
import { MilestonesBar } from "@/components/milestones-bar";
import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { createFeature } from "@/lib/actions";
import type { FeatureWithRelations, MilestoneWithProgress } from "@/lib/types";

export function FeaturesView({
  heading,
  features,
  nowISO,
  scopeProjectId,
  groupByProject,
  milestones,
  embedded = false,
}: {
  heading: string;
  features: FeatureWithRelations[];
  nowISO: string;
  scopeProjectId: string | null;
  groupByProject?: boolean;
  // Project milestones (release phases). When set on a scoped project, the
  // roadmap groups features by milestone and a management strip is shown.
  milestones?: MilestoneWithProgress[];
  // When embedded inside the Product tabs, skip the page Topbar and show a slim
  // action row instead (the surrounding tabs already provide the heading).
  embedded?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Selecting a milestone tile filters the roadmap to it (in-page; no nav).
  const [milestoneFilter, setMilestoneFilter] = useState<string | null>(null);

  const shownFeatures = useMemo(
    () =>
      milestoneFilter
        ? features.filter((f) => (f.milestoneId ?? null) === milestoneFilter)
        : features,
    [features, milestoneFilter],
  );
  const activeMilestone = milestones?.find((m) => m.id === milestoneFilter) ?? null;

  function newFeature() {
    if (!scopeProjectId) return;
    startTransition(async () => {
      const f = await createFeature({ projectId: scopeProjectId });
      router.push(`/projects/${scopeProjectId}/product/${f.id}`);
      router.refresh();
    });
  }

  const newButton = scopeProjectId ? (
    <Button size="sm" className="h-7 gap-1.5" onClick={newFeature} disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} New
      feature
    </Button>
  ) : null;

  return (
    <div className="flex h-full flex-col">
      {embedded ? (
        newButton && <div className="flex justify-end px-4 py-2">{newButton}</div>
      ) : (
        <Topbar breadcrumb={[{ label: heading }]} actions={newButton} />
      )}
      {scopeProjectId && milestones && (
        <MilestonesBar
          projectId={scopeProjectId}
          milestones={milestones}
          selectedId={milestoneFilter}
          onSelect={(id) => setMilestoneFilter((prev) => (prev === id ? null : id))}
        />
      )}
      {activeMilestone && (
        <div className="flex items-center gap-2 border-b bg-brand/5 px-4 py-1.5 text-xs">
          <span className="text-muted-foreground">Filtered to</span>
          <span className="font-medium">{activeMilestone.name}</span>
          <button
            onClick={() => setMilestoneFilter(null)}
            className="ml-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3" /> Clear
          </button>
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        <FeatureTimeline
          features={shownFeatures}
          nowISO={nowISO}
          groupByProject={groupByProject}
          milestones={milestones ? milestones.map((m) => ({ id: m.id, name: m.name })) : undefined}
        />
      </div>
    </div>
  );
}
