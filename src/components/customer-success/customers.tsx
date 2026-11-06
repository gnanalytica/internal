"use client";

import { Plus, Users } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { SendToProductButton, type ProductFeedback } from "@/components/product/send-to-product";
import { CHANNEL_TONE, KindDot, outcomeTone, StagePill, ToneChip } from "@/components/prospects-dashboard/bits";
import { Button } from "@/components/ui/button";
import { CHECK_INS_NEEDED, daysAgo, onboardingProgress, onboardingSteps, toggleStep, type Onboarding, type OnboardingStepId } from "@/lib/customer-success";
import { setOnboardingStep } from "@/lib/customer-success-actions";
import { entityCurrency, formatCurrency } from "@/lib/currency";
import { KIND_LABEL, type Channel } from "@/lib/prospects/schema";
import { canSendTouch, touchContact, touchSource, touchSourceRef } from "@/lib/send-to-product";
import { tone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { dayMonth, HealthChip, HealthDot, type CustomerView } from "./bits";
import { NewRequestDialog, RequestCard, sortRequests, type RequestCtx } from "./requests";

/* ---------- the list ---------- */

function CustomerCard({ c, selected, onSelect }: { c: CustomerView; selected: boolean; onSelect: () => void }) {
  const p = onboardingProgress(onboardingSteps(c.deal?.onboarding, c.checkIns));
  const line = [p.done === p.total ? "Onboarded" : `Onboarding · step ${p.current} of ${p.total}`, `${c.openRequests} open request${c.openRequests === 1 ? "" : "s"}`].join(" · ");
  return (
    <button
      type="button"
      data-customer={c.ref}
      aria-current={selected ? "true" : undefined}
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col gap-1.5 rounded-lg border bg-background px-3 py-2.5 text-left transition-colors outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50",
        selected && "border-foreground/70 ring-1 ring-foreground/70",
      )}
    >
      <span className="flex items-center gap-2">
        <HealthDot health={c.health} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
          <KindDot kind={c.kind} />
          {KIND_LABEL[c.kind].one}
        </span>
      </span>
      <span className="text-xs text-muted-foreground">{line}</span>
      <span className="sr-only">{`Health: ${c.health === "needs-call" ? "needs a call" : c.health === "new" ? "just started" : "doing fine"}.`}</span>
      <span aria-hidden className="h-1 overflow-hidden rounded-full bg-muted">
        <span className={cn("block h-full rounded-full transition-[width] duration-500", tone("blue").bar)} style={{ width: `${Math.round((p.done / p.total) * 100)}%` }} />
      </span>
    </button>
  );
}

function CustomerList({ customers, selected, onSelect }: { customers: CustomerView[]; selected: string | null; onSelect: (ref: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // Up and down move between customers, as in any list.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>("button[data-customer]") ?? [])];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    const next = buttons[Math.min(Math.max(i + (e.key === "ArrowDown" ? 1 : -1), 0), buttons.length - 1)];
    next?.focus();
    if (next?.dataset.customer) onSelect(next.dataset.customer);
  };
  return (
    <section aria-label="Customers" className="flex flex-col gap-1.5 border-b bg-muted/30 p-3 lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0">
      <div ref={ref} onKeyDown={onKeyDown} className="flex flex-col gap-1.5">
        {customers.map((c) => (
          <CustomerCard key={c.ref} c={c} selected={c.ref === selected} onSelect={() => onSelect(c.ref)} />
        ))}
      </div>
      <p className="mt-2 rounded-lg border bg-background px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">A prospect that reaches Pilot running or Won in Sales shows up here on its own, with the onboarding steps ready.</p>
    </section>
  );
}

/* ---------- one customer ---------- */

function planLabel(c: CustomerView): string {
  if (!c.deal) return c.stage === 5 ? "Won" : "Pilot";
  const money = c.deal.value ? formatCurrency(c.deal.value, entityCurrency(c.deal.entity)) : null;
  if (c.stage === 5) return money ?? "Won, no amount yet";
  return money ? `Pilot · ${money} deal` : "Pilot";
}

function Section({ title, aside, action, children, className, id }: { title: string; aside?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; id: string }) {
  return (
    <section aria-labelledby={id} className={cn("flex min-w-0 flex-col gap-2", className)}>
      <div className="flex min-h-7 items-center gap-2">
        <h2 id={id} className="flex-1 text-sm font-semibold">
          {title}
        </h2>
        {aside && <span className="font-mono text-xs text-muted-foreground">{aside}</span>}
        {action}
      </div>
      {children}
    </section>
  );
}

function OnboardingChecklist({ c, today, onChanged }: { c: CustomerView; today: string; onChanged: () => void }) {
  const [saved, setSaved] = useState<Onboarding>(c.deal?.onboarding ?? {});
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const steps = onboardingSteps(saved, c.checkIns);
  const p = onboardingProgress(steps);
  const toggle = (step: OnboardingStepId, done: boolean) => {
    const before = saved;
    setSaved((m) => toggleStep(m, step, done, today));
    setBusy(step);
    start(async () => {
      try {
        setSaved(await setOnboardingStep(c.ref, step, done));
        onChanged();
      } catch (e) {
        setSaved(before);
        toast.error(e instanceof Error ? e.message : "Couldn't save that step.");
      } finally {
        setBusy(null);
      }
    });
  };
  return (
    <Section id={`ob-${c.ref}`} title="Onboarding" aside={`${p.done} of ${p.total}`}>
      <ul className="flex flex-col">
        {steps.map((s) => {
          const note = s.auto
            ? `Ticked itself · ${c.checkIns} check-ins logged`
            : s.doneOn
              ? `Done ${dayMonth(s.doneOn)}`
              : s.id === "check-ins"
                ? `${Math.min(c.checkIns, CHECK_INS_NEEDED)} of ${CHECK_INS_NEEDED} done · ${s.hint.toLowerCase()}`
                : s.hint;
          const inputId = `ob-${c.ref}-${s.id}`;
          return (
            <li key={s.id} className="border-t border-border/60 first:border-t-0">
              <label htmlFor={inputId} className={cn("flex cursor-pointer items-start gap-2.5 py-2", s.auto && "cursor-default")}>
                <input
                  id={inputId}
                  type="checkbox"
                  checked={s.done}
                  disabled={s.auto || busy === s.id}
                  aria-describedby={`${inputId}-note`}
                  onChange={(e) => toggle(s.id, e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={cn("text-[13px]", s.done ? "text-muted-foreground line-through" : "font-medium")}>{s.title}</span>
                  <span id={`${inputId}-note`} className="text-xs text-muted-foreground">
                    {note}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function CheckIns({ c, fb }: { c: CustomerView; fb: ProductFeedback }) {
  return (
    <Section id={`ci-${c.ref}`} title="Check-ins" aside={c.touches.length ? String(c.touches.length) : undefined}>
      {c.touches.length ? (
        <ul className="flex flex-col">
          {c.touches.map((a) => (
            <li key={a.id || a.loggedAt} className="grid grid-cols-[auto_1fr_auto] items-baseline gap-x-3 gap-y-1 border-t border-border/60 py-2.5 text-[13px] first:border-t-0 sm:grid-cols-[64px_96px_minmax(0,1fr)_auto_auto]">
              <span className="font-mono text-xs text-muted-foreground">{a.date ? dayMonth(a.date) : "—"}</span>
              <span className="max-sm:justify-self-start">
                <ToneChip t={CHANNEL_TONE[a.channel as Channel] ?? "gray"}>{a.channel || "—"}</ToneChip>
              </span>
              <span className="col-span-2 leading-relaxed max-sm:row-start-2 sm:col-span-1">{a.summary || <span className="text-muted-foreground">No notes</span>}</span>
              <span className="justify-self-end max-sm:col-start-3 max-sm:row-start-1">
                <ToneChip t={outcomeTone(a.outcome)}>{a.outcome || "—"}</ToneChip>
              </span>
              <span className="self-center justify-self-end max-sm:col-start-3 max-sm:row-start-2">
                {canSendTouch(a) && <SendToProductButton fb={fb} payload={{ body: a.summary, contact: touchContact(c.name, c.stage), source: touchSource(c.stage), sourceRef: touchSourceRef(c.kind, c.id, a) }} />}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-4 text-[13px] leading-relaxed text-muted-foreground">
          No check-ins since they became a customer. Log one after every call, message or visit — it lands in the sheet&apos;s Activity tab, and {CHECK_INS_NEEDED} of them tick the onboarding step.
        </p>
      )}
    </Section>
  );
}

function CustomerRecord({ c, ctx, salesHref, today, onLog, onChanged, showValue }: { c: CustomerView; ctx: RequestCtx; salesHref: string; today: string; onLog: () => void; onChanged: () => void; showValue: boolean }) {
  const [newOpen, setNewOpen] = useState(false);
  const owner = c.assigned || c.deal?.owner || "";
  const where = [KIND_LABEL[c.kind].one, c.city || c.state].filter(Boolean).join(" · ");
  const requests = sortRequests(c.requests);
  const facts = [
    { label: "Last touch", value: daysAgo(c.lastTouch, today) },
    { label: "Plan", value: showValue ? planLabel(c) : c.stage === 5 ? "Won" : "Pilot" },
    { label: "Open requests", value: String(c.openRequests) },
    { label: "Stage", value: <StagePill stage={c.stage} /> },
  ];
  return (
    <section aria-label={c.name} className="flex min-w-0 flex-1 flex-col gap-6 px-3 py-4 sm:px-6 sm:py-5 lg:overflow-y-auto">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-60 flex-1 flex-col gap-1.5">
          <h1 className="text-[22px] font-semibold tracking-tight">{c.name}</h1>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <KindDot kind={c.kind} />
              {where}
            </span>
            {c.since && <span>Customer since {dayMonth(c.since.date)}</span>}
            {owner && (
              <span>
                Owner <span className="text-foreground">{owner}</span>
              </span>
            )}
            {/* Sales is admin-only, the same people who see deal values. */}
            {showValue && (
              <Link href={salesHref} className="text-primary hover:underline">
                Sales history →
              </Link>
            )}
          </p>
        </div>
        <HealthChip health={c.health} />
        <Button variant="outline" size="sm" onClick={onLog}>
          Log a check-in
        </Button>
      </div>

      <dl className="grid grid-cols-2 overflow-hidden rounded-lg border sm:grid-cols-4">
        {facts.map((f, i) => (
          <div key={f.label} className={cn("flex flex-col gap-1 px-3.5 py-3", i % 2 === 1 && "border-l", i >= 2 && "max-sm:border-t", i > 0 && "sm:border-l")}>
            <dt className="text-xs text-muted-foreground">{f.label}</dt>
            <dd className="text-[15px] font-medium">{f.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap gap-x-8 gap-y-6">
        <div className="min-w-0 flex-[1_1_300px]">
          <OnboardingChecklist key={c.ref} c={c} today={today} onChanged={onChanged} />
        </div>
        <div className="min-w-0 flex-[1_1_300px]">
          <Section
            id={`rq-${c.ref}`}
            title="Requests"
            aside={`${c.openRequests} open`}
            action={
              <Button variant="ghost" size="sm" onClick={() => setNewOpen(true)}>
                <Plus /> New request
              </Button>
            }
          >
            {requests.length ? (
              <div className="flex flex-col gap-2">
                {requests.map((r) => (
                  <RequestCard key={r.id} request={r} ctx={ctx} contact={touchContact(c.name, c.stage)} />
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed px-4 py-4 text-[13px] text-muted-foreground">Nothing asked for yet. Add a request when they ask for something or report a problem.</p>
            )}
          </Section>
        </div>
      </div>

      <CheckIns c={c} fb={ctx.fb} />
      <NewRequestDialog open={newOpen} onOpenChange={setNewOpen} ctx={ctx} customers={[c]} fixedRef={c.ref} />
    </section>
  );
}

/* ---------- the tab ---------- */

export function CustomersTab({
  customers,
  selected,
  onSelect,
  ctx,
  projectId,
  today,
  onLog,
  onChanged,
  showValue,
  fromSheet,
}: {
  customers: CustomerView[];
  selected: string | null;
  onSelect: (ref: string) => void;
  ctx: RequestCtx;
  projectId: string;
  today: string;
  onLog: (c: CustomerView) => void;
  onChanged: () => void;
  showValue: boolean;
  fromSheet: boolean;
}) {
  if (!customers.length) {
    return (
      <EmptyState
        icon={<Users className="size-5" />}
        title="No customers yet"
        description={
          fromSheet
            ? "A prospect becomes a customer when Sales moves it to Pilot running or Won. It shows up here on its own, with the onboarding steps ready."
            : "Customers come from the prospects sheet, which only Valytica has. Requests and Answers still work here."
        }
      />
    );
  }
  const c = customers.find((x) => x.ref === selected) ?? customers[0];
  const salesHref = `/projects/${projectId}/sales?${new URLSearchParams({ rec: c.ref, rt: "activity" }).toString()}`;
  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <CustomerList customers={customers} selected={c.ref} onSelect={onSelect} />
      <CustomerRecord key={c.ref} c={c} ctx={ctx} salesHref={salesHref} today={today} onLog={() => onLog(c)} onChanged={onChanged} showValue={showValue} />
    </div>
  );
}
