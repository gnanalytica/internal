import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { api, type ItemResponse, type ListResponse } from "@/lib/api";
import { queryClient } from "@/lib/query";

export type Ref = { id: string; name: string };
export type Issue = {
  id: string;
  identifier: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  estimate: number | null;
  startDate: string | null;
  dueDate: string | null;
  assignee: Ref | null;
  assignees?: Ref[];
  project: { id: string; key: string; name: string } | null;
  cycleId: string | null;
  milestoneId: string | null;
  featureId: string | null;
  parentId: string | null;
  labels: { id: string; name: string; color: string }[];
  createdAt: string;
  updatedAt: string;
  url: string;
};

export type Comment = { id: string; body: string; author: Ref | null; createdAt: string; reactions?: { emoji: string; count: number; mine: boolean }[] };
export type Relation = { id: string; type: string; issueId: string; issue?: { id: string; identifier: string; title: string; status: string } | null };
export type Attachment = { id: string; name: string; url: string; contentType: string | null; size: number; createdAt?: string };
export type TimelineEvent = { id: string; kind: "activity" | "comment"; action?: string; body?: string; actor: Ref | null; createdAt: string; meta?: Record<string, unknown>; reactions?: { emoji: string; count: number; mine: boolean }[] };

export type IssueDetail = Issue & {
  description: string | null;
  assignees: Ref[];
  subIssues: { id: string; identifier: string; title: string; status: string; type: string }[];
  pages: { id: string; title: string; icon: string }[];
  attachments: Attachment[];
  comments: Comment[];
  relations: Relation[];
  creator?: Ref | null;
  favorite?: boolean;
  watching?: boolean;
};

export type IssueFilters = { status?: string; project?: string; assignee?: string; type?: string; cycle?: string; milestone?: string; priority?: string; label?: string; mine?: boolean };

export const issuesQuery = (filters: IssueFilters) =>
  infiniteQueryOptions({
    queryKey: ["issues", filters],
    queryFn: async ({ pageParam }) => api.get<ListResponse<Issue>>("/issues", { ...filters, mine: filters.mine ? "true" : undefined, limit: 100, cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor ?? null,
  });

export const issueQuery = (id: string) =>
  queryOptions({
    queryKey: ["issue", id],
    queryFn: async () => (await api.get<ItemResponse<IssueDetail>>(`/issues/${id}`)).data,
  });

export const timelineQuery = (id: string) =>
  queryOptions({
    queryKey: ["issue", id, "timeline"],
    queryFn: async () => (await api.get<ListResponse<TimelineEvent>>(`/issues/${id}/timeline`)).data,
  });

/** Every issue list and this issue's detail are stale after a change. */
export async function refreshIssue(id?: string): Promise<void> {
  await Promise.all([queryClient.invalidateQueries({ queryKey: ["issues"] }), id ? queryClient.invalidateQueries({ queryKey: ["issue", id] }) : null]);
}

export async function updateIssue(id: string, patch: Record<string, unknown>): Promise<void> {
  queryClient.setQueryData<IssueDetail>(["issue", id], (old) => (old ? { ...old, ...(patch as Partial<IssueDetail>) } : old));
  try {
    await api.patch(`/issues/${id}`, patch);
  } finally {
    await refreshIssue(id);
  }
}

export async function createIssue(input: Record<string, unknown>): Promise<Issue> {
  const res = await api.post<ItemResponse<Issue>>("/issues", input);
  await refreshIssue();
  return res.data;
}

export async function addComment(issueId: string, body: string): Promise<void> {
  await api.post(`/issues/${issueId}/comments`, { body });
  await queryClient.invalidateQueries({ queryKey: ["issue", issueId] });
}

export async function deleteComment(issueId: string, commentId: string): Promise<void> {
  await api.del(`/comments/${commentId}`);
  await queryClient.invalidateQueries({ queryKey: ["issue", issueId] });
}
