import "server-only";

import { checkInCount, customerSince, isCustomerStage, touchesSince, type CustomerSince, type Onboarding } from "@/lib/customer-success";
import { getDeals, getSupportAnswers, getTickets } from "@/lib/data";
import { prospectRef } from "@/lib/prospects/deal-plan";
import type { ActivityEntry } from "@/lib/prospects/parse";
import { loadWorkbook } from "@/lib/prospects/read";
import { PROSPECT_KINDS, prospectsSheetUrl, type ProspectKind } from "@/lib/prospects/schema";
import { todayIST } from "@/lib/prospects/stats";
import type { SupportAnswer, TicketWithRelations } from "@/lib/types";

/** A customer's deal, as the page needs it. `value` is null for people who may not see deal values. */
export type CustomerDeal = {
  id: string;
  stage: string;
  value: number | null;
  entity: string;
  /** ISO timestamp. */
  createdAt: string;
  owner: string;
  onboarding: Onboarding;
};

export type Customer = {
  /** "<kind>:<id>", the prospect ref deals and links use. */
  ref: string;
  kind: ProspectKind;
  id: string;
  name: string;
  city: string;
  state: string;
  stage: number;
  assigned: string;
  nextStep: string;
  /** ISO date of the latest touch: the sheet's last_contacted or the newest Activity row. */
  lastTouch: string | null;
  deal: CustomerDeal | null;
  since: CustomerSince | null;
  /** Touches since they became a customer, newest first. */
  touches: ActivityEntry[];
  checkIns: number;
};

export type CustomerSuccessData = {
  projectId: string;
  /** Whether customers come from the prospects sheet here (Valytica only). */
  fromSheet: boolean;
  customers: Customer[];
  requests: TicketWithRelations[];
  answers: SupportAnswer[];
  /** Every deal on the project by id, so a request still names its customer after they leave. */
  dealNames: Record<string, string>;
  today: string;
  /** Server time when read, so ages render the same on server and client. */
  now: number;
  warnings: string[];
  sheetUrl: string;
  /** Whether the viewer may see deal values — the same people who can open Sales. */
  showValue: boolean;
};

const latest = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

/**
 * Everything the Customer Success page shows for one project. Customers are
 * the prospects at Pilot running or Won, read from the sheet; their deals,
 * requests and saved answers come from the database.
 */
export async function loadCustomerSuccess(input: { workspaceId: string; projectId: string; fromSheet: boolean; showValue: boolean }): Promise<CustomerSuccessData> {
  const { workspaceId, projectId, fromSheet, showValue } = input;
  const [deals, requests, answers, wb] = await Promise.all([
    getDeals(workspaceId, projectId),
    getTickets(workspaceId, projectId),
    getSupportAnswers(workspaceId, projectId),
    fromSheet ? loadWorkbook() : null,
  ]);
  const byRef = new Map(deals.filter((d) => d.prospectRef).map((d) => [d.prospectRef!, d]));

  const customers: Customer[] = [];
  if (wb) {
    const lists: Record<ProspectKind, typeof wb.valuers> = { valuer: wb.valuers, firm: wb.firms, rvo: wb.rvos, panel: wb.panels, bank: wb.banks };
    const records = PROSPECT_KINDS.flatMap((k) => lists[k]).filter((r) => isCustomerStage(r.stage));
    const ids = new Set(records.map((r) => r.id));
    const activityById = new Map<string, ActivityEntry[]>();
    for (const a of wb.activity) {
      if (!ids.has(a.registrationNo)) continue;
      const list = activityById.get(a.registrationNo) ?? [];
      list.push(a);
      activityById.set(a.registrationNo, list);
    }
    for (const r of records) {
      const ref = prospectRef(r.kind, r.id);
      const d = byRef.get(ref);
      const activity = activityById.get(r.id) ?? [];
      const since = customerSince(activity, d?.createdAt ?? null);
      const newest = activity.reduce<string | null>((m, a) => latest(m, a.date), null);
      customers.push({
        ref,
        kind: r.kind,
        id: r.id,
        name: r.name || r.id,
        city: r.city,
        state: r.state,
        stage: r.stage,
        assigned: r.assigned,
        nextStep: r.nextStep,
        lastTouch: latest(r.lastContacted, newest),
        deal: d
          ? {
              id: d.id,
              stage: d.stage,
              value: showValue ? d.value : null,
              entity: d.entity,
              createdAt: new Date(d.createdAt).toISOString(),
              owner: (d.owner?.name || d.owner?.email || "").trim(),
              onboarding: d.onboarding ?? {},
            }
          : null,
        since,
        touches: touchesSince(activity, since),
        checkIns: checkInCount(activity, since),
      });
    }
  }

  return {
    projectId,
    fromSheet,
    customers,
    requests,
    answers,
    dealNames: Object.fromEntries(deals.map((d) => [d.id, d.name])),
    today: todayIST(),
    now: Date.now(),
    warnings: wb?.warnings ?? [],
    sheetUrl: prospectsSheetUrl(),
    showValue,
  };
}
