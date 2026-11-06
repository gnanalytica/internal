"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { DepartmentHeader } from "@/components/department-header";
import { LogTouchDialog, type LogTarget } from "@/components/prospects-dashboard/log-touch-dialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { customerHealth, HEALTH, requestState } from "@/lib/customer-success";
import type { CustomerSuccessData } from "@/lib/customer-success-data";
import { cn } from "@/lib/utils";
import { AnswersTab } from "./answers";
import { HealthDot, type CustomerView } from "./bits";
import { CustomersTab } from "./customers";
import { RequestsTab, type RequestCtx } from "./requests";

type Tab = "customers" | "requests" | "answers";
const TAB_IDS: Tab[] = ["customers", "requests", "answers"];

/** Pick a customer to log a check-in for, from the header. */
function CheckInPicker({ customers, onPick }: { customers: CustomerView[]; onPick: (c: CustomerView) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button size="sm" className="h-8 shrink-0 max-sm:px-2.5" disabled={!customers.length}>
            Log<span className="max-sm:hidden">&nbsp;a check-in</span>
          </Button>
        }
      />
      <PopoverContent align="end" className="w-[min(92vw,340px)] gap-0 p-1">
        <p className="px-2 pt-1.5 pb-1 text-xs text-muted-foreground">Log a check-in for…</p>
        <div className="flex max-h-80 flex-col overflow-y-auto">
          {customers.map((c) => (
            <button
              key={c.ref}
              type="button"
              onClick={() => {
                setOpen(false);
                onPick(c);
              }}
              className="flex h-9 items-center gap-2.5 rounded-md px-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            >
              <HealthDot health={c.health} />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <span className="text-xs text-muted-foreground">{HEALTH[c.health].label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Customer Success, customer first: every prospect at Pilot running or Won is
 * a customer with an onboarding checklist, requests and check-ins. View state
 * lives in the URL (?tab=, ?c=) so a customer can be shared as a link.
 */
export function CustomerSuccessView({ data }: { data: CustomerSuccessData }) {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTabState] = useState<Tab>(() => (TAB_IDS as string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "customers");
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
  const setTab = (t: Tab) => {
    setTabState(t);
    sync({ tab: t === "customers" ? null : t });
  };
  const select = (ref: string) => {
    setSelectedState(ref);
    sync({ c: ref });
  };
  const openCustomer = (ref: string) => {
    setTabState("customers");
    setSelectedState(ref);
    sync({ tab: null, c: ref });
  };
  const onChanged = useCallback(() => router.refresh(), [router]);

  const customers: CustomerView[] = useMemo(() => {
    const list = data.customers.map((c) => {
      const requests = c.deal ? data.requests.filter((r) => r.dealId === c.deal!.id) : [];
      const health = customerHealth({ today: data.today, now: data.now, since: c.since, lastTouch: c.lastTouch, checkIns: c.checkIns, requests });
      return { ...c, requests, health, openRequests: requests.filter((r) => requestState(r.status) !== "answered").length };
    });
    return list.sort((a, b) => HEALTH[a.health].rank - HEALTH[b.health].rank || a.name.localeCompare(b.name));
  }, [data]);

  const ctx: RequestCtx = { projectId: data.projectId, now: data.now, answers: data.answers, onChanged };
  const openRequests = data.requests.filter((r) => requestState(r.status) !== "answered").length;
  const current = customers.find((c) => c.ref === selected) ?? customers[0] ?? null;

  const log = (c: CustomerView) => {
    setLogTarget({ kind: c.kind, id: c.id, name: c.name, stage: c.stage, nextStep: c.nextStep });
    setLogOpen(true);
  };

  return (
    <div className="flex h-full flex-col">
      <DepartmentHeader
        label="Customer Success views"
        tabs={[
          { id: "customers", label: "Customers", count: customers.length },
          { id: "requests", label: "Requests", count: openRequests },
          { id: "answers", label: "Answers", count: data.answers.length },
        ]}
        current={tab}
        onChange={setTab}
        actions={
          tab === "customers" && current ? (
            <Button size="sm" className="h-8 shrink-0 max-sm:px-2.5" onClick={() => log(current)}>
              Log<span className="max-sm:hidden">&nbsp;a check-in</span>
            </Button>
          ) : (
            <CheckInPicker customers={customers} onPick={log} />
          )
        }
      />

      {data.warnings.length > 0 && (
        <div role="alert" className="mx-3 mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 sm:mx-6 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {data.warnings.slice(0, 3).map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      )}

      <div key={tab} className={cn("animate-enter min-h-0 flex-1", tab === "customers" ? "flex flex-col overflow-y-auto lg:overflow-hidden" : "overflow-y-auto px-3 py-4 sm:px-6 sm:py-5")}>
        {tab === "customers" ? (
          <CustomersTab
            customers={customers}
            selected={current?.ref ?? null}
            onSelect={select}
            ctx={ctx}
            projectId={data.projectId}
            today={data.today}
            onLog={log}
            onChanged={onChanged}
            showValue={data.showValue}
            fromSheet={data.fromSheet}
          />
        ) : tab === "requests" ? (
          <RequestsTab requests={data.requests} customers={customers} dealNames={data.dealNames} ctx={ctx} onOpenCustomer={openCustomer} />
        ) : (
          <AnswersTab answers={data.answers} projectId={data.projectId} onChanged={onChanged} />
        )}
      </div>

      <LogTouchDialog title="Log a check-in" target={logTarget} today={data.today} open={logOpen} onOpenChange={setLogOpen} onSaved={onChanged} />
    </div>
  );
}
