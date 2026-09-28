"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { logTouch, saveProspect } from "@/lib/prospects/actions";
import { STAGES, type Channel, type Outcome } from "@/lib/prospects/schema";
import { addDays, myTasks, type ProspectRow } from "@/lib/prospects/stats";
import { cn } from "@/lib/utils";
import { BandBadge, DueChip, Empty, MissingValue, StagePill } from "./bits";
import { defaultStage } from "./log-touch-dialog";
import { useDetail } from "./record";

const DRAFT_TABS = [
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "Email" },
  { key: "call", label: "Call" },
  { key: "meeting", label: "Meeting" },
] as const;

type Quick = { label: string; hint: string; channel: Channel; outcome: Outcome; days: number | null; nextStep: string; extra?: Record<string, string> };

const QUICK: Quick[] = [
  { label: "Sent", hint: "follow up in 3 days", channel: "WhatsApp", outcome: "Sent", days: 3, nextStep: "Follow up if no reply" },
  { label: "No answer", hint: "retry tomorrow, other channel", channel: "Call", outcome: "No answer", days: 1, nextStep: "Try again on another channel" },
  { label: "Demo booked", hint: "status → Discovery done", channel: "Call", outcome: "Demo booked", days: 3, nextStep: "Run the demo" },
  { label: "Not interested", hint: "status → Lost · ask for a referral", channel: "Call", outcome: "Not interested", days: null, nextStep: "" },
  { label: "Wrong number", hint: "flags it for research", channel: "Call", outcome: "Wrong number", days: 2, nextStep: "Find a working number", extra: { research_status: "Needs a person" } },
];

export function MyWork({ rows, today, me, onOpen, onLog, onChanged }: { rows: ProspectRow[]; today: string; me: string; onOpen: (r: ProspectRow) => void; onLog: (r: ProspectRow) => void; onChanged: () => void }) {
  const tasks = useMemo(() => myTasks(rows, me, today), [rows, me, today]);
  const [selId, setSelId] = useState<string | null>(null);
  const cardRef = useRef<HTMLElement>(null);
  const [done, setDone] = useState(0);
  const [tab, setTab] = useState<(typeof DRAFT_TABS)[number]["key"]>("whatsapp");
  const [pending, start] = useTransition();
  const current = tasks.find((t) => `${t.row.kind}:${t.row.id}` === selId) ?? tasks[0];
  const detail = useDetail(current ? { kind: current.row.kind, id: current.row.id } : null);
  const r = detail.data?.record;
  const first = me.split(/\s+/)[0];

  if (!tasks.length) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-3 py-16 text-center">
        <h3 className="text-lg font-semibold">Nothing due for {first}</h3>
        <p className="text-sm text-muted-foreground">
          Your queue is built from rows whose <span className="font-mono">assigned</span> is {first} and whose next step is due today or overdue, plus A-band valuers of yours nobody has contacted yet. Pick some up from the Overview or the List.
        </p>
        {done > 0 && <p className="text-sm font-medium text-emerald-700">{done} done this session.</p>}
      </div>
    );
  }

  const quick = (q: Quick) =>
    start(async () => {
      if (!current) return;
      const row = current.row;
      const stage = defaultStage(row.stage, q.channel, q.outcome);
      const res = await logTouch({
        kind: row.kind,
        id: row.id,
        name: row.name,
        channel: q.channel,
        direction: "Outbound",
        outcome: q.outcome,
        durationMin: null,
        summary: "",
        statusAfter: STAGES[stage],
        nextStep: q.nextStep || null,
        nextStepDate: q.days === null ? null : addDays(today, q.days),
      });
      if (res.ok && q.extra && row.kind === "valuer") await saveProspect(row.kind, row.id, q.extra);
      if (res.ok) {
        toast.success(res.message);
        setDone((n) => n + 1);
        const next = tasks.find((t) => t !== current);
        setSelId(next ? `${next.row.kind}:${next.row.id}` : null);
        onChanged();
      } else toast.error(res.message);
    });

  const draft = r?.drafts[tab] ?? "";

  return (
    <div className="grid gap-4 lg:grid-cols-[440px_1fr]">
      <section aria-label="Your queue" className="flex flex-col gap-2">
        <div className="flex items-baseline gap-2">
          <h3 className="text-base font-semibold">Today</h3>
          <span className="flex-1 text-xs text-muted-foreground">
            {tasks.length} in your queue{done ? ` · ${done} done this session` : ""}
          </span>
        </div>
        {tasks.map((t) => {
          const on = t === current;
          return (
            <button
              key={`${t.row.kind}:${t.row.id}`}
              type="button"
              onClick={() => {
                setSelId(`${t.row.kind}:${t.row.id}`);
                // Below lg the task card sits above the queue, so bring it back into view.
                if (window.matchMedia("(max-width: 1023px)").matches) cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={cn("flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/50", on && "border-foreground ring-1 ring-foreground")}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">{t.reason === "new" ? "First contact" : t.row.nextStep || "Follow up"}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {t.row.name} · {t.row.city || t.row.state || t.row.kind.toUpperCase()}
                </span>
              </span>
              <span className="flex flex-col items-end gap-1">
                {t.reason === "new" ? <span className="rounded bg-emerald-100 px-1.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">New</span> : <DueChip date={t.row.nextStepDate} today={today} />}
                <BandBadge band={t.row.band} score={t.row.score} />
              </span>
            </button>
          );
        })}
      </section>

      {current && (
        <section ref={cardRef} className="flex min-w-0 scroll-mt-3 flex-col overflow-hidden rounded-xl border bg-card max-lg:order-first">
          <div className="flex flex-col gap-2 border-b p-3 sm:p-4">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-lg font-semibold">{current.row.name}</h3>
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {current.row.city || current.row.state} <StagePill stage={current.row.stage} /> {r?.pitchAngle ? `· pitch: ${r.pitchAngle}` : ""}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => onOpen(current.row)}>
                Open record
              </Button>
            </div>
            {r && (
              <div className="flex flex-wrap gap-1.5 text-xs">
                {r.lenders.length ? <span className="rounded-full bg-muted px-2 py-0.5">{r.lenders.length} lender panels</span> : <MissingValue>Lenders unknown</MissingValue>}
                {r.casesPerMonth !== null ? <span className="rounded-full bg-muted px-2 py-0.5">{r.casesPerMonth} cases / month</span> : <MissingValue>Volume unknown — ask</MissingValue>}
                {r.software ? <span className="rounded-full bg-muted px-2 py-0.5">{r.software}</span> : <MissingValue>Software unknown — ask</MissingValue>}
                {r.phone ? <a href={`tel:${r.phone}`} className="rounded-full bg-muted px-2 py-0.5 hover:underline">{r.phone}</a> : <MissingValue>No phone</MissingValue>}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3 p-3 sm:p-4">
            <div className="flex items-center gap-1.5">
              {DRAFT_TABS.map((d) => (
                <button key={d.key} type="button" aria-pressed={d.key === tab} onClick={() => setTab(d.key)} className={cn("h-7 rounded-full border px-3 text-xs font-medium", d.key === tab ? "border-foreground bg-foreground text-background" : "hover:bg-muted")}>
                  {d.label}
                </button>
              ))}
              <span className="flex-1" />
              {draft && (
                <Button size="xs" variant="outline" onClick={() => navigator.clipboard.writeText(draft).then(() => toast.success("Draft copied"))}>
                  Copy
                </Button>
              )}
            </div>
            <div className={cn("min-h-44 rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed whitespace-pre-wrap", detail.loading && "opacity-60")}>
              {draft || <span className="text-muted-foreground">No {DRAFT_TABS.find((d) => d.key === tab)!.label} draft yet — the research agents write one per record. You can also write it from the record.</span>}
            </div>
            <p className="text-xs font-medium text-muted-foreground">How did it go? One click writes the sheet and schedules the follow-up.</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {QUICK.map((q) => (
                <button key={q.label} type="button" disabled={pending} onClick={() => quick(q)} className="flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left hover:bg-muted disabled:opacity-50">
                  <span className="text-[13px] font-medium">{q.label}</span>
                  <span className="text-[11px] text-muted-foreground">{q.hint}</span>
                </button>
              ))}
              <button type="button" onClick={() => onLog(current.row)} className="flex flex-col items-start gap-0.5 rounded-lg border border-foreground/40 px-3 py-2 text-left hover:bg-muted">
                <span className="text-[13px] font-medium">Replied / talked…</span>
                <span className="text-[11px] text-muted-foreground">log what they said</span>
              </button>
            </div>
          </div>
        </section>
      )}
      {!current && <Empty>Pick a task.</Empty>}
    </div>
  );
}
