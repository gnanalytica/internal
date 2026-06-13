import { issueIdentifier } from "@/lib/types";
import type {
  Cycle,
  Initiative,
  IssueWithRelations,
  Page,
  Project,
  TeamWithCount,
} from "@/lib/types";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "";

export function issueDto(i: IssueWithRelations) {
  return {
    id: i.id,
    identifier: issueIdentifier(i),
    title: i.title,
    status: i.status,
    priority: i.priority,
    estimate: i.estimate,
    dueDate: i.dueDate,
    assignee: i.assignee ? { id: i.assignee.id, name: i.assignee.name } : null,
    project: i.project
      ? { id: i.project.id, key: i.project.key, name: i.project.name }
      : null,
    cycleId: i.cycleId,
    teamId: i.teamId,
    parentId: i.parentId,
    labels: i.labels.map((l) => ({ id: l.id, name: l.name, color: l.color })),
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
    url: BASE ? `${BASE}/issues/${i.id}` : `/issues/${i.id}`,
  };
}

export function projectDto(p: Project) {
  return {
    id: p.id,
    name: p.name,
    key: p.key,
    color: p.color,
    description: p.description,
    initiativeId: p.initiativeId,
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

export function initiativeDto(i: Initiative) {
  return {
    id: i.id,
    name: i.name,
    description: i.description,
    status: i.status,
    color: i.color,
    targetDate: i.targetDate,
  };
}

export function teamDto(t: TeamWithCount) {
  return {
    id: t.id,
    name: t.name,
    key: t.key,
    icon: t.icon,
    issueCount: t.issueCount,
    memberCount: t.memberCount,
  };
}

export function pageDto(p: Pick<Page, "id" | "title" | "icon">) {
  return { id: p.id, title: p.title, icon: p.icon };
}
