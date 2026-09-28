import { queryOptions } from "@tanstack/react-query";

import type { Issue } from "@/features/issues/api";
import { api, type ItemResponse, type ListResponse } from "@/lib/api";
import { queryClient } from "@/lib/query";

export type Ref = { id: string; name: string };
export type Progress = { done: number; total: number; pct: number };
export type Health = "on_track" | "at_risk" | "off_track" | "none";
export type CycleState = "upcoming" | "active" | "completed";

export type Department = { slug: string; label: string; color: string; stat?: string };

export type CycleRow = {
  id: string;
  name: string;
  number: number;
  startDate: string;
  endDate: string;
  projectId: string;
  project: { id: string; name: string; color: string };
  state: CycleState;
  issueCount: number;
  doneCount: number;
  progress: Progress;
  points: { total: number; done: number };
};

export type MilestoneRef = { id: string; name: string; status: string; targetDate: string | null };

export type ProjectSummary = {
  id: string;
  name: string;
  key: string;
  kind: "project" | "operation";
  confidential: boolean;
  color: string;
  description: string | null;
  tagline: string | null;
  url: string | null;
  startDate: string | null;
  targetDate: string | null;
  ownerId: string | null;
  owner: Ref | null;
  health: Health;
  currentMilestone: MilestoneRef | null;
  progress: Progress;
  openIssues: number;
  openMilestones: number;
  activeCampaigns: number;
  openTickets: number;
  metricCount: number;
  openDeals: number | null;
  pipelineValue: number | null;
  revenue: number | null;
  visibleDepartments: Department[];
  activeCycle: CycleRow | null;
};

export type StatusUpdate = { id: string; health: string; body: string; createdAt: string; author: Ref | null };

export type Milestone = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  targetDate: string | null;
  projectId: string;
  featureCount: number;
  progress: Progress;
};

export type ProjectDetail = Omit<ProjectSummary, "currentMilestone" | "visibleDepartments" | "openIssues" | "activeCampaigns" | "openTickets" | "metricCount" | "openDeals" | "pipelineValue" | "revenue"> & {
  strategistId: string | null;
  strategist: Ref | null;
  enabledDepartments: string[] | null;
  visibleDepartments: Department[];
  cycleCadence: { ceremonies: { title: string; dayOffset?: number | null; estimate?: number | null }[] } | null;
  latestStatusUpdate: StatusUpdate | null;
  statusUpdates: StatusUpdate[];
  currentMilestone: Milestone | null;
  canEditOwner: boolean;
  watching: boolean;
  favorite: boolean;
};

export type Feature = {
  id: string;
  title: string;
  status: string;
  startDate: string | null;
  targetDate: string | null;
  projectId: string | null;
  milestone: Ref | null;
  owner: Ref | null;
  pageId: string | null;
  progress: Progress;
};

export type MiniProject = { id: string; name: string; key: string; color: string };

export type FeatureDetail = Feature & {
  project: MiniProject | null;
  page: { id: string; title: string; icon: string } | null;
  spec: string;
  createdAt: string;
  updatedAt: string;
  issues: Issue[];
};

export type MilestoneDetail = Milestone & { project: MiniProject | null; features: Feature[]; issues: Issue[] };

export type Feedback = {
  id: string;
  title: string;
  body: string | null;
  source: string;
  status: string;
  votes: number;
  contact: string | null;
  featureId: string | null;
  projectId: string | null;
  createdAt: string;
};

export type MetricPoint = { id: string; periodDate: string; value: number };
export type Metric = {
  id: string;
  name: string;
  unit: string | null;
  cadence: string;
  isNorthStar: boolean;
  projectId: string | null;
  latest: number | null;
  previous: number | null;
  target: number | null;
  targetDirection: "above" | "below";
  points: MetricPoint[];
};

export type Velocity = {
  cycles: { id: string; name: string; donePoints: number; doneCount: number; completionPct: number }[];
  averagePoints: number;
  averageCompletionPct: number;
  cyclesToClear: number | null;
};

export type CycleDetail = Omit<CycleRow, "project"> & {
  project: MiniProject | null;
  byStatus: Record<string, number>;
  burndown: { points: { date: string; remaining: number; ideal: number }[]; totalPoints: number };
};

export type ProjectPage = { id: string; title: string; icon: string; parentId: string | null; depth: number; childCount: number; updatedAt: string };

const get = async <T>(path: string, query?: Record<string, string | undefined>) => (await api.get<ItemResponse<T>>(path, query)).data;
const list = async <T>(path: string, query?: Record<string, string | undefined>) => (await api.get<ListResponse<T>>(path, query)).data;

export const summariesQuery = queryOptions({
  queryKey: ["projects", "summaries"],
  queryFn: () => list<ProjectSummary>("/projects/summaries"),
});

export const projectQuery = (id: string) => queryOptions({ queryKey: ["project", id], queryFn: () => get<ProjectDetail>(`/projects/${id}`) });

export const milestonesQuery = (projectId: string) =>
  queryOptions({ queryKey: ["milestones", projectId], queryFn: () => list<Milestone>("/milestones", { project: projectId }) });

export const milestoneQuery = (id: string) => queryOptions({ queryKey: ["milestone", id], queryFn: () => get<MilestoneDetail>(`/milestones/${id}`) });

export const featuresQuery = (projectId: string) =>
  queryOptions({ queryKey: ["features", projectId], queryFn: () => list<Feature>("/features", { project: projectId }) });

export const featureQuery = (id: string) => queryOptions({ queryKey: ["feature", id], queryFn: () => get<FeatureDetail>(`/features/${id}`) });

export const feedbackQuery = (projectId: string) =>
  queryOptions({ queryKey: ["feedback", projectId], queryFn: () => list<Feedback>("/feedback", { project: projectId }) });

export const metricsQuery = (projectId: string) =>
  queryOptions({ queryKey: ["metrics", projectId], queryFn: () => list<Metric>("/metrics", { project: projectId }) });

export const projectCyclesQuery = (projectId: string) =>
  queryOptions({
    queryKey: ["cycles", { project: projectId }],
    queryFn: async () => {
      const res = await api.get<ListResponse<CycleRow> & { velocity?: Velocity }>("/cycles", { project: projectId });
      return { cycles: res.data, velocity: res.velocity ?? null };
    },
  });

export const cycleQuery = (id: string) => queryOptions({ queryKey: ["cycle", id], queryFn: () => get<CycleDetail>(`/cycles/${id}`) });

export const projectPagesQuery = (projectId: string) =>
  queryOptions({ queryKey: ["project", projectId, "pages"], queryFn: () => list<ProjectPage>(`/projects/${projectId}/pages`) });

// ---- Writes: optimistic where the screen shows the value, then re-read ----

const invalidate = (...keys: unknown[][]) => Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));

export async function updateProject(id: string, patch: Record<string, unknown>): Promise<void> {
  queryClient.setQueryData<ProjectDetail>(["project", id], (old) => (old ? { ...old, ...(patch as Partial<ProjectDetail>) } : old));
  try {
    await api.patch(`/projects/${id}`, patch);
  } finally {
    await invalidate(["project", id], ["projects"]);
  }
}

export async function createProject(input: { name: string; kind: "project" | "operation"; ownerId?: string | null }): Promise<{ id: string }> {
  const res = await api.post<ItemResponse<{ id: string }>>("/projects", input);
  await invalidate(["projects"]);
  return res.data;
}

export async function postStatusUpdate(projectId: string, health: string, body: string): Promise<void> {
  await api.post(`/projects/${projectId}/status-updates`, { health, body });
  await invalidate(["project", projectId], ["projects"]);
}

export async function createMilestone(input: { projectId: string; name: string; targetDate?: string | null }): Promise<void> {
  await api.post("/milestones", input);
  await invalidate(["milestones", input.projectId], ["project", input.projectId], ["projects"]);
}

export async function updateMilestone(id: string, projectId: string, patch: Record<string, unknown>): Promise<void> {
  queryClient.setQueryData<MilestoneDetail>(["milestone", id], (old) => (old ? { ...old, ...(patch as Partial<MilestoneDetail>) } : old));
  try {
    await api.patch(`/milestones/${id}`, patch);
  } finally {
    await invalidate(["milestone", id], ["milestones", projectId], ["project", projectId], ["projects"]);
  }
}

export async function createFeature(input: { projectId: string; milestoneId?: string | null; title: string }): Promise<{ id: string }> {
  const res = await api.post<ItemResponse<{ id: string }>>("/features", input);
  await invalidate(["features", input.projectId], ["milestones", input.projectId], input.milestoneId ? ["milestone", input.milestoneId] : ["milestone"]);
  return res.data;
}

export async function updateFeature(id: string, patch: Record<string, unknown>): Promise<void> {
  queryClient.setQueryData<FeatureDetail>(["feature", id], (old) => (old ? { ...old, ...(patch as Partial<FeatureDetail>) } : old));
  try {
    const res = await api.patch<ItemResponse<FeatureDetail>>(`/features/${id}`, patch);
    queryClient.setQueryData(["feature", id], res.data);
  } finally {
    await invalidate(["feature", id], ["features"], ["milestone"], ["milestones"]);
  }
}

export async function createFeedback(input: { projectId: string; title: string; body?: string; source: string; contact?: string }): Promise<void> {
  await api.post("/feedback", input);
  await invalidate(["feedback", input.projectId]);
}

export async function updateFeedback(id: string, projectId: string, patch: Record<string, unknown>): Promise<void> {
  queryClient.setQueryData<Feedback[]>(["feedback", projectId], (old) => old?.map((f) => (f.id === id ? { ...f, ...(patch as Partial<Feedback>) } : f)));
  try {
    await api.patch(`/feedback/${id}`, patch);
  } finally {
    await invalidate(["feedback", projectId]);
  }
}

export async function createMetric(input: { projectId: string; name: string; unit?: string | null; cadence: string; target?: number | null; targetDirection?: "above" | "below"; isNorthStar?: boolean }): Promise<void> {
  await api.post("/metrics", input);
  await invalidate(["metrics", input.projectId], ["project", input.projectId], ["projects"]);
}

export async function updateMetric(id: string, projectId: string, patch: Record<string, unknown>): Promise<void> {
  queryClient.setQueryData<Metric[]>(["metrics", projectId], (old) => old?.map((m) => (m.id === id ? { ...m, ...(patch as Partial<Metric>) } : m)));
  try {
    await api.patch(`/metrics/${id}`, patch);
  } finally {
    await invalidate(["metrics", projectId]);
  }
}

export async function addMetricPoint(metricId: string, projectId: string, periodDate: string, value: number): Promise<void> {
  await api.post(`/metrics/${metricId}/points`, { periodDate, value });
  await invalidate(["metrics", projectId]);
}

export async function createCycle(input: { projectId: string; name: string; startDate: string; endDate: string }): Promise<void> {
  await api.post("/cycles", input);
  await invalidate(["cycles"], ["project", input.projectId], ["projects"]);
}

export async function createProjectPage(projectId: string, title = "Untitled"): Promise<{ id: string }> {
  const res = await api.post<ItemResponse<{ id: string }>>("/pages", { projectId, title });
  await invalidate(["project", projectId, "pages"], ["pages"]);
  return res.data;
}
