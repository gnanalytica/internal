import { PRIORITY_MAP, STATUS_MAP, type PriorityId, type StatusId } from "@/lib/constants";
import type { ActivityEntry, ProspectRecord } from "@/lib/prospects/parse";
import { KIND_LABEL, STAGES } from "@/lib/prospects/schema";
import { addDays, dueBucket } from "@/lib/prospects/stats";
import { issueIdentifier } from "../cards";

/**
 * What tools hand back to the model: small, flat objects with the record's
 * link, so answers can link everything they mention. Pure.
 */

export type TaskRow = {
  id: string;
  number: number;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  updatedAt: Date;
  projectId: string | null;
  projectKey: string | null;
  projectName: string | null;
  assigneeName: string | null;
};

export const OPEN_STATUSES = ["backlog", "todo", "in_progress", "in_review"] as const;
export const isOpenStatus = (s: string) => (OPEN_STATUSES as readonly string[]).includes(s);

/** yyyy-mm-dd of a stored due date (they're saved as midnight UTC dates). */
export const dayOf = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);

export const taskUrl = (appUrl: string, id: string) => `${appUrl}/issues/${id}`;

export function taskBrief(r: TaskRow, appUrl: string, today: string) {
  const due = dayOf(r.dueDate);
  return {
    key: issueIdentifier(r),
    title: r.title,
    url: taskUrl(appUrl, r.id),
    status: STATUS_MAP[r.status as StatusId]?.label ?? r.status,
    priority: PRIORITY_MAP[r.priority as PriorityId]?.label ?? r.priority,
    assignee: r.assigneeName ?? "Unassigned",
    project: r.projectName,
    due,
    ...(due && due < today && isOpenStatus(r.status) ? { overdue: true } : {}),
  };
}

/** Open tasks by urgency: overdue, then soonest due, then priority, then most recently touched. */
export function byUrgency(a: TaskRow, b: TaskRow): number {
  const da = dayOf(a.dueDate);
  const db = dayOf(b.dueDate);
  if (da !== db) {
    if (!da) return 1;
    if (!db) return -1;
    return da < db ? -1 : 1;
  }
  const pa = PRIORITY_MAP[a.priority as PriorityId]?.rank ?? 4;
  const pb = PRIORITY_MAP[b.priority as PriorityId]?.rank ?? 4;
  if (pa !== pb) return pa - pb;
  return b.updatedAt.getTime() - a.updatedAt.getTime();
}

/**
 * A project at a glance. "Blocked" is an open task that another open task
 * blocks (issue relations of type "blocks"); `blockedIds` is that set.
 */
export function projectStatus(rows: TaskRow[], blockedIds: ReadonlySet<string>, appUrl: string, today: string) {
  const open = rows.filter((r) => isOpenStatus(r.status));
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const weekAgo = addDays(today, -7);
  const overdue = open.filter((r) => {
    const d = dayOf(r.dueDate);
    return d !== null && d < today;
  });
  const done = rows
    .filter((r) => r.status === "done" && r.updatedAt.toISOString().slice(0, 10) >= weekAgo)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const blocked = open.filter((r) => blockedIds.has(r.id));
  const brief = (r: TaskRow) => taskBrief(r, appUrl, today);
  return {
    counts: {
      open: open.length,
      backlog: count("backlog"),
      todo: count("todo"),
      in_progress: count("in_progress"),
      in_review: count("in_review"),
      blocked: blocked.length,
      overdue: overdue.length,
      done_last_7_days: done.length,
    },
    overdue: overdue.sort(byUrgency).slice(0, 8).map(brief),
    blocked: blocked.slice(0, 8).map(brief),
    recently_done: done.slice(0, 8).map(brief),
  };
}

/* ---------- a Slack thread as a task ---------- */

/**
 * The description of a task made from a Slack thread: the gist, the key
 * points as a list, and where it came from — so anyone opening the task can
 * get back to the conversation.
 */
export function threadTaskDescription(t: {
  summary: string;
  keyPoints: string[];
  permalink: string | null;
  where: string;
  by: string;
}): string {
  const parts: string[] = [];
  if (t.summary.trim()) parts.push(t.summary.trim());
  const points = t.keyPoints.map((p) => p.trim()).filter(Boolean);
  if (points.length) parts.push(["**Key points**", ...points.map((p) => `- ${p}`)].join("\n"));
  const source = t.permalink ? `[the Slack thread](${t.permalink})` : "a Slack thread";
  parts.push(`_From ${source} in ${t.where}, filed by ${t.by} with the Internal bot._`);
  return parts.join("\n\n");
}

/* ---------- prospects ---------- */

export const prospectUrl = (appUrl: string, kind: string, id: string) =>
  `${appUrl}/prospects?rec=${encodeURIComponent(`${kind}:${id}`)}`;

export const stageName = (stage: number): string => STAGES[stage] ?? STAGES[0];

export function prospectBrief(r: ProspectRecord, appUrl: string, today: string) {
  const due = dueBucket(r.nextStepDate, today);
  return {
    id: r.id,
    name: r.name,
    type: KIND_LABEL[r.kind].one,
    url: prospectUrl(appUrl, r.kind, r.id),
    stage: stageName(r.stage),
    city: [r.city, r.state].filter(Boolean).join(", ") || null,
    assigned: r.assigned || null,
    next_step: r.nextStep || null,
    next_step_date: r.nextStepDate,
    ...(due === "overdue" || due === "today" ? { follow_up: due } : {}),
    last_contacted: r.lastContacted,
    band: r.band || null,
  };
}

/** One prospect in full: the brief, plus what they said on the latest touches. */
export function prospectDetail(r: ProspectRecord, activity: ActivityEntry[], appUrl: string, today: string) {
  return {
    ...prospectBrief(r, appUrl, today),
    key_contact: r.keyContact || null,
    has_phone: Boolean(r.phone),
    has_email: Boolean(r.email),
    software: r.software || null,
    cases_per_month: r.casesPerMonth,
    pitch_angle: r.pitchAngle || null,
    objections: r.objections || null,
    referred_by: r.referredBy || null,
    notes: r.notes ? r.notes.slice(0, 1200) : null,
    recent_touches: activity.slice(0, 5).map((a) => ({
      when: a.date ?? a.loggedAt,
      by: a.by,
      how: `${a.direction} ${a.channel}`.trim(),
      outcome: a.outcome,
      what_they_said: a.summary || null,
      stage_after: a.statusAfter || null,
    })),
  };
}

/** Does this prospect match a free-text search? Every word must appear somewhere it's known by. */
export function prospectMatches(r: ProspectRecord, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = [r.id, r.name, r.city, r.state, r.keyContact, r.firmRegNo, r.bank.institution, r.bank.contactPerson]
    .join(" ")
    .toLowerCase();
  return words.every((w) => hay.includes(w));
}
