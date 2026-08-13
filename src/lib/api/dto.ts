import { issueIdentifier } from "@/lib/types";
import type {
  CampaignWithRelations,
  FeatureWithRelations,
  Label,
  MilestoneWithProgress,
  ContactWithAccount,
  CrmAccount,
  Cycle,
  DealWithRelations,
  ExpenseWithRelations,
  InvoiceWithRelations,
  IssueWithRelations,
  Page,
  Project,
  TicketWithRelations,
} from "@/lib/types";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "";

export function issueDto(i: IssueWithRelations) {
  return {
    id: i.id,
    identifier: issueIdentifier(i),
    title: i.title,
    // The department lens on a task — see ISSUE_TYPES.
    type: i.type,
    status: i.status,
    priority: i.priority,
    estimate: i.estimate,
    startDate: i.startDate,
    dueDate: i.dueDate,
    assignee: i.assignee ? { id: i.assignee.id, name: i.assignee.name } : null,
    project: i.project
      ? { id: i.project.id, key: i.project.key, name: i.project.name }
      : null,
    cycleId: i.cycleId,
    milestoneId: i.milestoneId,
    featureId: i.featureId,
    parentId: i.parentId,
    labels: i.labels.map((l) => ({ id: l.id, name: l.name, color: l.color })),
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
    url: BASE ? `${BASE}/issues/${i.id}` : `/issues/${i.id}`,
  };
}

/**
 * The full issue view: everything `getIssue` already loads but the list DTO
 * omits — assignee set, sub-tasks, linked docs and attachments.
 */
export function issueDetailDto(i: IssueWithRelations) {
  const withRelations = i as IssueWithRelations & {
    assignees?: { id: string; name: string }[];
    subIssues?: IssueWithRelations[];
    pageLinks?: { page: { id: string; title: string; icon: string } }[];
    attachments?: {
      id: string;
      name: string;
      url: string;
      contentType: string | null;
      size: number;
    }[];
  };
  return {
    ...issueDto(i),
    assignees: (withRelations.assignees ?? []).map((a) => ({
      id: a.id,
      name: a.name,
    })),
    subIssues: (withRelations.subIssues ?? []).map((s) => ({
      id: s.id,
      identifier: issueIdentifier(s),
      title: s.title,
      status: s.status,
      type: s.type,
    })),
    pages: (withRelations.pageLinks ?? []).map((l) => ({
      id: l.page.id,
      title: l.page.title,
      icon: l.page.icon,
    })),
    attachments: (withRelations.attachments ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      url: a.url,
      contentType: a.contentType,
      size: a.size,
    })),
  };
}

export function projectDto(p: Project) {
  return {
    id: p.id,
    name: p.name,
    key: p.key,
    color: p.color,
    description: p.description,
    startDate: p.startDate,
    targetDate: p.targetDate,
  };
}

export function cycleDto(c: Cycle) {
  return {
    id: c.id,
    name: c.name,
    number: c.number,
    startDate: c.startDate,
    endDate: c.endDate,
  };
}

export function pageDto(p: Pick<Page, "id" | "title" | "icon">) {
  return { id: p.id, title: p.title, icon: p.icon };
}

export function milestoneDto(m: MilestoneWithProgress) {
  return {
    id: m.id,
    name: m.name,
    description: m.description,
    status: m.status,
    targetDate: m.targetDate,
    projectId: m.projectId,
    featureCount: m.featureCount,
    progress: m.progress,
  };
}

export function featureDto(f: FeatureWithRelations) {
  return {
    id: f.id,
    title: f.title,
    status: f.status,
    startDate: f.startDate,
    targetDate: f.targetDate,
    projectId: f.projectId,
    milestone: f.milestone ? { id: f.milestone.id, name: f.milestone.name } : null,
    owner: f.owner ? { id: f.owner.id, name: f.owner.name } : null,
    pageId: f.pageId,
    progress: f.progress,
  };
}

export function labelDto(l: Label) {
  return { id: l.id, name: l.name, color: l.color };
}

// ---- CRM / Sales / Marketing / Finance / Support ----
const ref = (x: { id: string; name: string } | null) =>
  x ? { id: x.id, name: x.name } : null;

export function dealDto(d: DealWithRelations) {
  return {
    id: d.id,
    name: d.name,
    stage: d.stage,
    value: d.value,
    entity: d.entity,
    expectedClose: d.expectedClose,
    project: ref(d.project),
    account: ref(d.account),
    contact: ref(d.contact),
    ownerId: d.ownerId,
    createdAt: d.createdAt,
  };
}

export function accountDto(a: CrmAccount) {
  return {
    id: a.id,
    name: a.name,
    website: a.website,
    industry: a.industry,
    type: a.type,
    entity: a.entity,
    ownerId: a.ownerId,
  };
}

export function contactDto(c: ContactWithAccount) {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    title: c.title,
    phone: c.phone,
    lifecycleStage: c.lifecycleStage,
    entity: c.entity,
    account: ref(c.account),
  };
}

export function campaignDto(c: CampaignWithRelations) {
  return {
    id: c.id,
    name: c.name,
    channel: c.channel,
    status: c.status,
    budget: c.budget,
    entity: c.entity,
    startDate: c.startDate,
    endDate: c.endDate,
    project: ref(c.project),
    contentCount: c.contentCount,
  };
}

export function invoiceDto(i: InvoiceWithRelations) {
  return {
    id: i.id,
    number: i.number,
    status: i.status,
    amount: i.amount,
    entity: i.entity,
    issueDate: i.issueDate,
    dueDate: i.dueDate,
    project: ref(i.project),
    account: ref(i.account),
  };
}

export function expenseDto(e: ExpenseWithRelations) {
  return {
    id: e.id,
    vendor: e.vendor,
    category: e.category,
    amount: e.amount,
    status: e.status,
    entity: e.entity,
    spentDate: e.spentDate,
    project: ref(e.project),
  };
}

export function ticketDto(t: TicketWithRelations) {
  return {
    id: t.id,
    subject: t.subject,
    status: t.status,
    priority: t.priority,
    entity: t.entity,
    requesterEmail: t.requesterEmail,
    project: ref(t.project),
    account: ref(t.account),
    contact: ref(t.contact),
    assigneeId: t.assigneeId,
    createdAt: t.createdAt,
  };
}
