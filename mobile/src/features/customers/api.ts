import { queryOptions } from "@tanstack/react-query";
import { router } from "expo-router";

import { api, type ItemResponse } from "@/lib/api";
import { queryClient } from "@/lib/query";

import type { Ticket } from "@/features/business/api";
import type { ProspectKind } from "@/features/prospects/model";

/**
 * One customer of Valytica (a prospect at Pilot running or Won), as
 * `GET /projects/{id}/customers/{kind}/{cid}` sends it: the web works out
 * health, onboarding and the plan on the server, so the phone just shows them.
 */

export type Health = "needs-call" | "fine" | "new";
export type RequestState = "waiting-us" | "waiting-them" | "answered";

export type OnboardingStep = {
  id: string;
  title: string;
  hint: string;
  done: boolean;
  /** yyyy-mm-dd it was ticked by hand, if it was. */
  doneOn: string | null;
  /** Ticked itself because enough check-ins were logged. */
  auto: boolean;
};

export type CustomerRequest = Ticket & {
  body: string | null;
  dealId: string | null;
  via: string | null;
  viaLabel: string;
  state: RequestState;
  stateLabel: string;
};

export type CheckIn = {
  id: string;
  loggedAt: string;
  date: string | null;
  by: string;
  channel: string;
  direction: string;
  outcome: string;
  durationMin: number | null;
  statusAfter: string;
  summary: string;
};

export type Customer = {
  ref: string;
  kind: ProspectKind;
  id: string;
  name: string;
  city: string;
  state: string;
  where: string;
  stage: number;
  owner: string;
  nextStep: string;
  lastTouch: string | null;
  lastTouchLabel: string;
  plan: string;
  since: { date: string; activityId: string | null } | null;
  health: Health;
  healthLabel: string;
  deal: { id: string; stage: string; value: number; entity: string; createdAt: string; owner: string } | null;
  onboarding: { steps: OnboardingStep[]; done: number; total: number; current: number; checkInsNeeded: number };
  checkIns: number;
  requests: CustomerRequest[];
  openRequests: number;
  touches: CheckIn[];
};

export type CustomerPayload = { customer: Customer; today: string; warnings: string[]; sheetUrl: string };

const path = (projectId: string, kind: ProspectKind, id: string) => `/projects/${projectId}/customers/${kind}/${encodeURIComponent(id)}`;

export const customerQuery = (projectId: string, kind: ProspectKind, id: string) =>
  queryOptions({
    queryKey: ["customers", projectId, kind, id],
    queryFn: async () => (await api.get<ItemResponse<CustomerPayload>>(path(projectId, kind, id))).data,
  });

/** Tick or untick an onboarding step: shown at once, put back if the save fails. */
export async function setOnboardingStep(projectId: string, kind: ProspectKind, id: string, step: string, done: boolean, today: string): Promise<void> {
  const key = customerQuery(projectId, kind, id).queryKey;
  const before = queryClient.getQueryData<CustomerPayload>(key);
  queryClient.setQueryData<CustomerPayload>(key, (old) => {
    if (!old) return old;
    const steps = old.customer.onboarding.steps.map((s) => (s.id === step ? { ...s, done: done || s.auto, doneOn: done ? (s.doneOn ?? today) : null } : s));
    const doneCount = steps.filter((s) => s.done).length;
    const firstOpen = steps.findIndex((s) => !s.done);
    return { ...old, customer: { ...old.customer, onboarding: { ...old.customer.onboarding, steps, done: doneCount, current: firstOpen < 0 ? steps.length : firstOpen + 1 } } };
  });
  try {
    await api.post(`${path(projectId, kind, id)}/onboarding`, { step, done });
  } catch (e) {
    if (before) queryClient.setQueryData(key, before);
    throw e;
  } finally {
    await queryClient.invalidateQueries({ queryKey: key });
  }
}

export const REQUEST_VIA = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "call", label: "Call" },
  { id: "email", label: "Email" },
  { id: "visit", label: "Visit" },
] as const;
export type RequestVia = (typeof REQUEST_VIA)[number]["id"];

/** A new request from this customer, waiting on us. */
export async function addRequest(projectId: string, kind: ProspectKind, id: string, input: { subject: string; body: string; via: RequestVia }): Promise<{ id: string }> {
  const res = await api.post<ItemResponse<{ id: string }>>(`${path(projectId, kind, id)}/requests`, input);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: customerQuery(projectId, kind, id).queryKey }),
    queryClient.invalidateQueries({ queryKey: ["biz", "tickets", projectId] }),
  ]);
  return res.data;
}

/** A customer's own screen (Sales → Customers → one customer). */
export function openCustomer(projectId: string, kind: ProspectKind, id: string): void {
  router.push({ pathname: "/projects/[id]/customers/[kind]/[cid]", params: { id: projectId, kind, cid: id } });
}
