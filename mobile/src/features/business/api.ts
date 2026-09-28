import { queryOptions, type QueryKey } from "@tanstack/react-query";

import { api, type ItemResponse, type ListResponse } from "@/lib/api";
import { queryClient } from "@/lib/query";

export type Ref = { id: string; name: string };

export type Deal = {
  id: string;
  name: string;
  stage: string;
  value: number;
  entity: string;
  expectedClose: string | null;
  project: Ref | null;
  account: Ref | null;
  contact: Ref | null;
  ownerId: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type Account = { id: string; name: string; website: string | null; industry: string | null; type: string; entity: string; ownerId: string | null };
export type Contact = { id: string; name: string; email: string | null; title: string | null; phone: string | null; lifecycleStage: string; entity: string; account: Ref | null };
export type Activity = { id: string; type: string; body: string | null; dueDate: string | null; done: boolean; dealId: string | null; accountId: string | null; contactId: string | null; projectId: string | null; actorId: string | null; createdAt: string };

export type Ticket = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  entity: string;
  requesterEmail: string | null;
  project: Ref | null;
  account: Ref | null;
  contact: Ref | null;
  assigneeId: string | null;
  contactId?: string | null;
  issueId?: string | null;
  issue?: { id: string; number: number; title: string } | null;
  createdAt: string;
  updatedAt?: string;
};
export type TicketComment = { id: string; body: string; author: Ref | null; createdAt: string };
export type TicketDetail = Ticket & { body: string | null; comments: TicketComment[] };

export type Campaign = {
  id: string;
  name: string;
  channel: string;
  status: string;
  budget: number;
  entity: string;
  startDate: string | null;
  endDate: string | null;
  project: Ref | null;
  contentCount: number;
  reach?: number;
  replies?: number;
  conversions?: number;
  pageId?: string | null;
  ownerId?: string | null;
};
export type ContentItem = { id: string; title: string; channel: string | null; status: string; url: string | null; notes: string | null; publishDate: string | null; projectId: string | null; campaign: Ref | null; ownerId: string | null };

export type Invoice = { id: string; number: string | null; status: string; amount: number; entity: string; issueDate: string | null; dueDate: string | null; project: Ref | null; account: Ref | null };
export type Expense = { id: string; vendor: string | null; category: string; amount: number; status: string; entity: string; spentDate: string | null; project: Ref | null };
export type FinanceSummary = { currency: string; issued: number; paid: number; outstanding: number; overdue: number; draft: number; expenses: number; expensesPaid: number; net: number; invoiceCount: number; expenseCount: number; byCategory: { id: string; amount: number }[] };
export type Finance = {
  project: { id: string; name: string; key: string; ownerId: string | null };
  enabled: boolean;
  currency: string;
  entityCurrency: Record<string, string>;
  summary: FinanceSummary;
  invoices: Invoice[];
  expenses: Expense[];
};

// ---- Strategy (shapes from the web's src/lib/strategy.ts) ----
export type StageStatus = "active" | "next" | "goal" | "done";
export type KpiState = "ok" | "warn" | "bad" | "na";
export type Pillar = "desirability" | "feasibility" | "viability";
export type StageKpi = { name: string; current?: number | string | null; target?: number | null; autoKey?: string; tip?: string; state?: KpiState };
export type Stage = { id: string; label: string; status: StageStatus; what?: string; why?: string; kpis: StageKpi[]; exitCriteria?: string; killCriteria?: string };
export type Signal = { id: string; pillar: Pillar; claim: string; ok: boolean; why?: string; source?: { label: string; href?: string }; date?: string; stageId?: string; riskiest?: boolean; autoKey?: string };
export type Initiative = { id: string; name: string; stageId?: string; signalId?: string; milestoneId?: string; done?: boolean };
export type Metric = { label: string; current?: number | null; target?: number | null; autoKey?: string };
export type StrategyModel = {
  vision?: string;
  problem?: { pains: { label: string; signalId?: string }[]; whyNow?: string };
  stages: Stage[];
  signals: Signal[];
  initiatives: Initiative[];
  northStar?: Metric;
  proofMetrics?: Metric[];
  market?: { tamLabel?: string; tam?: string; sam?: number; capturePct?: number };
  positioning?: { xLabel?: string; yLabel?: string; dots: { label: string; x: number; y: number; self?: boolean }[] };
  guardrails?: string[];
};
export type StrategyView = {
  model: StrategyModel;
  routeProgress: number;
  pillars: { id: Pillar; label: string; question: string; score: number | null; ok: number; total: number; history: number[] }[];
  stages: { id: string; progress: number; kpiStates: KpiState[] }[];
  staleSignalIds: string[];
  autoKeys: string[];
  northStarPct: number | null;
  unitEconomics: { currency: string | null; unitLabel: string | null; segments: { id: string; label: string; model: string; price: number | null; cost: number | null; marginPct: number | null; heavyMarginPct: number | null }[] };
};
export type MilestoneProgress = { id: string; name: string; total: number; closed: number };
export type Strategy = { project: { id: string; name: string; key: string }; enabled: boolean; milestones: MilestoneProgress[]; view: StrategyView | null };
export type StrategyOp = { op: string } & Record<string, unknown>;

// ---- Queries ----

const list = async <T>(path: string, query?: Record<string, string>) => (await api.get<ListResponse<T>>(path, query)).data;

export const dealsQuery = (project: string) => queryOptions({ queryKey: ["biz", "deals", project], queryFn: () => list<Deal>("/deals", { project }) });
export const accountsQuery = queryOptions({ queryKey: ["biz", "accounts"], queryFn: () => list<Account>("/accounts"), staleTime: 5 * 60_000 });
export const contactsQuery = queryOptions({ queryKey: ["biz", "contacts"], queryFn: () => list<Contact>("/contacts"), staleTime: 5 * 60_000 });
export const activitiesQuery = (deal: string) => queryOptions({ queryKey: ["biz", "activities", deal], queryFn: () => list<Activity>("/activities", { deal }) });
export const ticketsQuery = (project: string) => queryOptions({ queryKey: ["biz", "tickets", project], queryFn: () => list<Ticket>("/tickets", { project }) });
export const ticketQuery = (id: string) => queryOptions({ queryKey: ["biz", "ticket", id], queryFn: async () => (await api.get<ItemResponse<TicketDetail>>(`/tickets/${id}`)).data });
export const campaignsQuery = (project: string) => queryOptions({ queryKey: ["biz", "campaigns", project], queryFn: () => list<Campaign>("/campaigns", { project }) });
export const contentQuery = (project: string) => queryOptions({ queryKey: ["biz", "content", project], queryFn: () => list<ContentItem>("/content", { project }) });
export const financeQuery = (project: string) => queryOptions({ queryKey: ["biz", "finance", project], queryFn: async () => (await api.get<ItemResponse<Finance>>(`/projects/${project}/finance`)).data });
export const strategyQuery = (project: string) => queryOptions({ queryKey: ["biz", "strategy", project], queryFn: async () => (await api.get<ItemResponse<Strategy>>(`/projects/${project}/strategy`)).data });

// ---- Writes ----

export type Resource = "deals" | "accounts" | "contacts" | "activities" | "tickets" | "campaigns" | "content" | "invoices" | "expenses";

/** Which cached reads a write to each resource can change. */
const AFFECTS: Record<Resource, QueryKey[]> = {
  deals: [["biz", "deals"]],
  accounts: [["biz", "accounts"], ["biz", "deals"], ["biz", "contacts"], ["biz", "tickets"], ["biz", "ticket"], ["biz", "finance"]],
  contacts: [["biz", "contacts"], ["biz", "deals"], ["biz", "tickets"], ["biz", "ticket"]],
  activities: [["biz", "activities"]],
  tickets: [["biz", "tickets"], ["biz", "ticket"]],
  campaigns: [["biz", "campaigns"], ["biz", "content"]],
  content: [["biz", "content"], ["biz", "campaigns"]],
  invoices: [["biz", "finance"]],
  expenses: [["biz", "finance"]],
};

export async function refresh(resource: Resource): Promise<void> {
  await Promise.all(AFFECTS[resource].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

/** Show a change at once in any cached list or item holding this row, then save it. */
export async function patchRecord(resource: Resource, id: string, patch: Record<string, unknown>, display: Record<string, unknown> = {}): Promise<void> {
  const shown = { ...patch, ...display };
  const merge = (row: unknown) => (row && typeof row === "object" && (row as { id?: string }).id === id ? { ...row, ...shown } : row);
  for (const key of AFFECTS[resource]) {
    queryClient.setQueriesData<unknown>({ queryKey: key }, (old: unknown) => {
      if (Array.isArray(old)) return old.map(merge);
      if (old && typeof old === "object" && "invoices" in old && "expenses" in old) {
        const f = old as Finance;
        return { ...f, invoices: f.invoices.map(merge), expenses: f.expenses.map(merge) };
      }
      return merge(old);
    });
  }
  try {
    await api.patch(`/${resource}/${id}`, patch);
  } finally {
    await refresh(resource);
  }
}

export async function createRecord<T = { id: string }>(resource: Resource, body: Record<string, unknown>): Promise<T> {
  const res = await api.post<ItemResponse<T>>(`/${resource}`, body);
  await refresh(resource);
  return res.data;
}

export async function deleteRecord(resource: Resource, id: string): Promise<void> {
  await api.del(`/${resource}/${id}`);
  await refresh(resource);
}

export async function replyToTicket(id: string, body: string): Promise<void> {
  await api.post(`/tickets/${id}/comments`, { body });
  await queryClient.invalidateQueries({ queryKey: ["biz", "ticket", id] });
}

export async function convertTicket(id: string): Promise<{ issue: { id: string; identifier?: string; title?: string }; created: boolean }> {
  const res = await api.post<ItemResponse<{ issue: { id: string; identifier?: string; title?: string }; created: boolean }>>(`/tickets/${id}/convert`);
  await Promise.all([refresh("tickets"), queryClient.invalidateQueries({ queryKey: ["issues"] })]);
  return res.data;
}

/** Apply one strategy edit; the answer is the updated surface, cached at once. */
export async function applyStrategy(project: string, op: StrategyOp): Promise<void> {
  const res = await api.post<ItemResponse<Strategy>>(`/projects/${project}/strategy`, op);
  queryClient.setQueryData(["biz", "strategy", project], res.data);
}
