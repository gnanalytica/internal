"use client";

import { FeaturesView } from "@/components/features-view";
import { FeedbackView } from "@/components/feedback-view";
import { Topbar } from "@/components/topbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FeatureWithRelations, FeedbackWithRelations } from "@/lib/types";

/**
 * The Product department surface: Roadmap (features timeline) + Feedback
 * (discovery). Feedback links into the roadmap, closing the discovery loop.
 */
export function ProductView({
  heading,
  scopeProjectId,
  features,
  nowISO,
  feedback,
}: {
  heading: string;
  scopeProjectId: string;
  features: FeatureWithRelations[];
  nowISO: string;
  feedback: FeedbackWithRelations[];
}) {
  const featureRefs = features.map((f) => ({ id: f.id, title: f.title }));

  return (
    <div className="flex h-full flex-col">
      <Topbar breadcrumb={[{ label: heading }]} />
      <Tabs defaultValue="roadmap" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-4 mt-2 self-start">
          <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
          <TabsTrigger value="feedback">
            Feedback{feedback.length > 0 ? ` · ${feedback.length}` : ""}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="roadmap" className="min-h-0 flex-1 overflow-hidden">
          <FeaturesView
            heading={heading}
            features={features}
            nowISO={nowISO}
            scopeProjectId={scopeProjectId}
            embedded
          />
        </TabsContent>
        <TabsContent value="feedback" className="min-h-0 flex-1 overflow-hidden">
          <FeedbackView
            scopeProjectId={scopeProjectId}
            initialFeedback={feedback}
            features={featureRefs}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
