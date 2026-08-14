import "server-only";

import {
  getBlockedIssueIds,
  getCyclesFlat,
  getLabels,
  getMembers,
  getMilestonesFlat,
  getProjects,
  getSavedViews,
} from "@/lib/data";
import type { TaskContext } from "@/lib/types";

/**
 * Load everything `IssuesView` needs besides the issues themselves.
 *
 * Every getter here is `"use cache"`d and tagged, so pulling the whole set
 * costs a page no more than pulling one of them — which is what lets each task
 * surface render the full tool instead of settling for a read-only list.
 */
export async function getTaskContext(workspaceId: string): Promise<TaskContext> {
  const [projects, members, labels, savedViews, cycles, milestones, blockedIds] =
    await Promise.all([
      getProjects(workspaceId),
      getMembers(workspaceId),
      getLabels(workspaceId),
      getSavedViews(workspaceId),
      getCyclesFlat(workspaceId),
      getMilestonesFlat(workspaceId),
      getBlockedIssueIds(workspaceId),
    ]);

  return { projects, members, labels, savedViews, cycles, milestones, blockedIds };
}
