"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2, Plus } from "lucide-react";

import { FeatureTimeline } from "@/components/feature-timeline";
import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { createFeature } from "@/lib/actions";
import type { FeatureWithRelations } from "@/lib/types";

export function FeaturesView({
  heading,
  features,
  nowISO,
  scopeProjectId,
  groupByProject,
}: {
  heading: string;
  features: FeatureWithRelations[];
  nowISO: string;
  scopeProjectId: string | null;
  groupByProject?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function newFeature() {
    if (!scopeProjectId) return;
    startTransition(async () => {
      const f = await createFeature({ projectId: scopeProjectId });
      router.push(`/projects/${scopeProjectId}/features/${f.id}`);
      router.refresh();
    });
  }

  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[{ label: heading }]}
        actions={
          scopeProjectId ? (
            <Button size="sm" className="h-7 gap-1.5" onClick={newFeature} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} New
              feature
            </Button>
          ) : null
        }
      />
      <div className="flex-1 overflow-hidden">
        <FeatureTimeline features={features} nowISO={nowISO} groupByProject={groupByProject} />
      </div>
    </div>
  );
}
