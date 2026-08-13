"use client";

import { FeedbackView } from "@/components/feedback-view";
import { MilestoneRoadmap } from "@/components/milestone-roadmap";
import { Topbar } from "@/components/topbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  FeedbackWithRelations,
  IssueWithRelations,
  MilestoneWithProgress,
} from "@/lib/types";

/**
 * The Product department surface: Roadmap (milestones and the tasks that
 * deliver them) + Feedback (discovery).
 *
 * Tasks hang straight off a milestone. There is no epic layer in between: a
 * milestone is a date, a task is work, and grouping work by capability is what
 * labels are for.
 */
export function ProductView({
  heading,
  scopeProjectId,
  issues,
  feedback,
  milestones,
}: {
  heading: string;
  scopeProjectId: string;
  issues: IssueWithRelations[];
  feedback: FeedbackWithRelations[];
  milestones: MilestoneWithProgress[];
}) {
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
          <MilestoneRoadmap
            projectId={scopeProjectId}
            milestones={milestones}
            issues={issues}
          />
        </TabsContent>
        <TabsContent value="feedback" className="min-h-0 flex-1 overflow-hidden">
          <FeedbackView scopeProjectId={scopeProjectId} initialFeedback={feedback} features={[]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
