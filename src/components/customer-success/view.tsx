"use client";

import { BookOpen } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { useProductFeedbackState } from "@/components/product/send-to-product";
import { Segmented } from "@/components/prospects-dashboard/bits";
import { LogTouchDialog, type LogTarget } from "@/components/prospects-dashboard/log-touch-dialog";
import { Button } from "@/components/ui/button";
import { customerHealth, HEALTH, requestState } from "@/lib/customer-success";
import type { CustomerSuccessData } from "@/lib/customer-success-data";
import type { ProspectKind } from "@/lib/prospects/schema";
import { cn } from "@/lib/utils";
import { type CustomerView } from "./bits";
import { CustomersTab } from "./customers";
import { RequestsTab, type RequestCtx } from "./requests";

type Show = "customers" | "requests";

/**
 * The Customers tab of Valytica's Sales workspace (it was the Customer
 * Success page): every prospect at Pilot running or Won is a customer with an
 * onboarding checklist, requests and check-ins. "Open requests" lists every
 * request across customers, as the old Requests tab did. View state lives in
 * the URL (?c= the customer, ?cf=requests) so either can be shared as a link.
 */
export function CustomersPanel({
  data,
  onOpenProspect,
  onOpenAnswers,
}: {
  data: CustomerSuccessData;
  /** Open a customer's prospect record in Sales, on its Activity tab. */
  onOpenProspect: (r: { kind: ProspectKind; id: string }) => void;
  /** Open the saved answers (Playbook → Answers). */
  onOpenAnswers: () => void;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [show, setShowState] = useState<Show>(() => (params.get("cf") === "requests" ? "requests" : "customers"));
  const [selected, setSelectedState] = useState<string | null>(params.get("c"));
  const [logTarget, setLogTarget] = useState<LogTarget | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  const sync = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, []);
  const setShow = (s: Show) => {
    setShowState(s);
    sync({ cf: s === "customers" ? null : s });
  };
  const select = (ref: string) => {
    setSelectedState(ref);
    sync({ c: ref });
  };
  const openCustomer = (ref: string) => {
    setShowState("customers");
    setSelectedState(ref);
    sync({ cf: null, c: ref });
  };
  const onChanged = useCallback(() => router.refresh(), [router]);
  const fb = useProductFeedbackState(data.feedback);

  const customers: CustomerView[] = useMemo(() => {
    const list = data.customers.map((c) => {
      const requests = c.deal ? data.requests.filter((r) => r.dealId === c.deal!.id) : [];
      const health = customerHealth({ today: data.today, now: data.now, since: c.since, lastTouch: c.lastTouch, checkIns: c.checkIns, requests });
      return { ...c, requests, health, openRequests: requests.filter((r) => requestState(r.status) !== "answered").length };
    });
    return list.sort((a, b) => HEALTH[a.health].rank - HEALTH[b.health].rank || a.name.localeCompare(b.name));
  }, [data]);

  const ctx: RequestCtx = { projectId: data.projectId, now: data.now, answers: data.answers, onChanged, fb };
  const openRequests = data.requests.filter((r) => requestState(r.status) !== "answered").length;
  const current = customers.find((c) => c.ref === selected) ?? customers[0] ?? null;

  const log = (c: CustomerView) => {
    setLogTarget({ kind: c.kind, id: c.id, name: c.name, stage: c.stage, nextStep: c.nextStep });
    setLogOpen(true);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 sm:px-6">
        <Segmented
          label="Show customers or open requests"
          value={show}
          onChange={setShow}
          options={[
            {
              value: "customers",
              label: (
                <>
                  Customers<span className="ml-1.5 font-mono text-[11px] text-muted-foreground/70">{customers.length}</span>
                </>
              ),
            },
            {
              value: "requests",
              label: (
                <>
                  Open requests<span className="ml-1.5 font-mono text-[11px] text-muted-foreground/70">{openRequests}</span>
                </>
              ),
            },
          ]}
        />
        <span className="flex-1" />
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onOpenAnswers}>
          <BookOpen /> Saved answers<span className="ml-0.5 font-mono text-[11px] text-muted-foreground/70">{data.answers.length}</span>
        </Button>
      </div>

      {data.warnings.length > 0 && (
        <div role="alert" className="mx-3 mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 sm:mx-6 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {data.warnings.slice(0, 3).map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      )}

      <div key={show} className={cn("animate-enter min-h-0 flex-1", show === "customers" ? "flex flex-col overflow-y-auto lg:overflow-hidden" : "overflow-y-auto px-3 py-4 sm:px-6 sm:py-5")}>
        {show === "customers" ? (
          <CustomersTab
            customers={customers}
            selected={current?.ref ?? null}
            onSelect={select}
            ctx={ctx}
            today={data.today}
            onLog={log}
            onChanged={onChanged}
            showValue={data.showValue}
            fromSheet={data.fromSheet}
            onOpenProspect={onOpenProspect}
          />
        ) : (
          <RequestsTab requests={data.requests} customers={customers} dealNames={data.dealNames} ctx={ctx} onOpenCustomer={openCustomer} />
        )}
      </div>

      <LogTouchDialog title="Log a check-in" target={logTarget} today={data.today} open={logOpen} onOpenChange={setLogOpen} onSaved={onChanged} />
    </div>
  );
}
