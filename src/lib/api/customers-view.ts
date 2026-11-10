/**
 * Sales → Customers as the API sends it: what `loadCustomerSuccess` returns,
 * with what the web's CustomersPanel works out in the browser — each
 * customer's health, onboarding steps, requests and plan — done here once, so
 * the phone shows the same thing without its own copy of the rules. Pure.
 */
import {
  CHECK_INS_NEEDED,
  customerHealth,
  daysAgo,
  HEALTH,
  onboardingProgress,
  onboardingSteps,
  planLabel,
  requestState,
  requestStateMeta,
  sortRequests,
  viaLabel,
  type Health,
  type RequestState,
  type StepState,
} from "@/lib/customer-success";
import type { Customer, CustomerSuccessData } from "@/lib/customer-success-data";
import type { ActivityEntry } from "@/lib/prospects/parse";
import { KIND_LABEL } from "@/lib/prospects/schema";
import type { TicketWithRelations } from "@/lib/types";

import { ticketDto } from "./dto";

export type CustomerRequestView = ReturnType<typeof ticketDto> & {
  body: string | null;
  dealId: string | null;
  /** How it came in: whatsapp, call, email, visit — and its label. */
  via: string | null;
  viaLabel: string;
  state: RequestState;
  stateLabel: string;
};

export type CustomerView = {
  /** "<kind>:<id>", the prospect ref deals use. */
  ref: string;
  kind: Customer["kind"];
  id: string;
  name: string;
  city: string;
  state: string;
  /** "Valuer · Hyderabad". */
  where: string;
  stage: number;
  /** Who looks after them: the sheet's assigned, else the deal's owner. */
  owner: string;
  nextStep: string;
  lastTouch: string | null;
  /** "8 days ago", "Never". */
  lastTouchLabel: string;
  /** "Pilot · ₹50,000 deal". */
  plan: string;
  since: Customer["since"];
  health: Health;
  healthLabel: string;
  deal: Omit<NonNullable<Customer["deal"]>, "onboarding"> | null;
  onboarding: { steps: StepState[]; done: number; total: number; current: number; checkInsNeeded: number };
  checkIns: number;
  /** Waiting on us first, then waiting on them, then answered. */
  requests: CustomerRequestView[];
  openRequests: number;
  /** Touches since they became a customer, newest first. */
  touches: ActivityEntry[];
};

export function requestView(t: TicketWithRelations): CustomerRequestView {
  const state = requestState(t.status);
  return {
    ...ticketDto(t),
    body: t.body ?? null,
    dealId: t.dealId ?? null,
    via: t.via ?? null,
    viaLabel: viaLabel(t.via),
    state,
    stateLabel: requestStateMeta(state).label,
  };
}

/** Every customer, needs-a-call first, as the web's list orders them. */
export function customerViews(data: Pick<CustomerSuccessData, "customers" | "requests" | "today" | "now">): CustomerView[] {
  const list = data.customers.map((c): CustomerView => {
    const requests = c.deal ? data.requests.filter((r) => r.dealId === c.deal!.id) : [];
    const health = customerHealth({ today: data.today, now: data.now, since: c.since, lastTouch: c.lastTouch, checkIns: c.checkIns, requests });
    const steps = onboardingSteps(c.deal?.onboarding, c.checkIns);
    const d = c.deal;
    return {
      ref: c.ref,
      kind: c.kind,
      id: c.id,
      name: c.name,
      city: c.city,
      state: c.state,
      where: [KIND_LABEL[c.kind].one, c.city || c.state].filter(Boolean).join(" · "),
      stage: c.stage,
      owner: c.assigned || c.deal?.owner || "",
      nextStep: c.nextStep,
      lastTouch: c.lastTouch,
      lastTouchLabel: daysAgo(c.lastTouch, data.today),
      plan: planLabel(c),
      since: c.since,
      health,
      healthLabel: HEALTH[health].label,
      deal: d ? { id: d.id, stage: d.stage, value: d.value, entity: d.entity, createdAt: d.createdAt, owner: d.owner } : null,
      onboarding: { steps, ...onboardingProgress(steps), checkInsNeeded: CHECK_INS_NEEDED },
      checkIns: c.checkIns,
      requests: sortRequests(requests).map(requestView),
      openRequests: requests.filter((r) => requestState(r.status) !== "answered").length,
      touches: c.touches,
    };
  });
  return list.sort((a, b) => HEALTH[a.health].rank - HEALTH[b.health].rank || a.name.localeCompare(b.name));
}
