"use client";

import { useState } from "react";

import { FeedbackView } from "@/components/feedback-view";
import { DepartmentTasks } from "@/components/department-tasks";
import { MilestoneRoadmap } from "@/components/milestone-roadmap";
import { Topbar } from "@/components/topbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  FeedbackWithRelations,
  IssueWithRelations,
  MilestoneWithProgress,
  TaskContext,
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
  ctx,
}: {
  heading: string;
  scopeProjectId: string;
  issues: IssueWithRelations[];
  feedback: FeedbackWithRelations[];
  milestones: MilestoneWithProgress[];
  ctx: TaskContext;
}) {
  // Held here rather than inside the roadmap so switching to Tasks and back
  // returns to the gate you were looking at.
  const [gate, setGate] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col">
      <Topbar breadcrumb={[{ label: heading }]} />
      <Tabs defaultValue="roadmap" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-4 mt-2 self-start">
          <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="feedback">
            Signals{feedback.length > 0 ? ` · ${feedback.length}` : ""}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="roadmap" className="min-h-0 flex-1 overflow-hidden">
          <MilestoneRoadmap
            projectId={scopeProjectId}
            milestones={milestones}
            issues={issues}
            ctx={ctx}
            selectedId={gate}
            onSelect={setGate}
          />
        </TabsContent>
        <TabsContent value="tasks" className="min-h-0 flex-1 overflow-hidden">
          <DepartmentTasks
            issues={issues}
            department="product"
            ctx={ctx}
            projectId={scopeProjectId}
            emptyLabel="No product, PM or risk tasks yet."
          />
        </TabsContent>

        <TabsContent value="feedback" className="min-h-0 flex-1 overflow-hidden">
          <FeedbackView scopeProjectId={scopeProjectId} initialFeedback={feedback} features={[]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
