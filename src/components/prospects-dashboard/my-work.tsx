"use client";

import { Copy, Phone } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { logTouch, saveProspect } from "@/lib/prospects/actions";
import { KIND_LABEL, STAGES, type Channel, type Outcome } from "@/lib/prospects/schema";
import { addDays, myTasks, type ProspectRow } from "@/lib/prospects/stats";
import { cn } from "@/lib/utils";
import { DueChip, Segmented } from "./bits";
import { defaultNextStep, defaultStage } from "./log-touch-dialog";
import { useDetail, type LogOpts } from "./record";

const DRAFT_TABS = [
  { key: "whatsapp", label: "WhatsApp", channel: "WhatsApp" },
  { key: "call", label: "Call script", channel: "Call" },
  { key: "email", label: "Email", channel: "Email" },
] as const;
type DraftKey = (typeof DRAFT_TABS)[number]["key"];

/** One click: log the touch, set the follow-up, move on. `log` opens the full log instead. */
type Quick = { label: string; hint: string; outcome: Outcome; days: number | null; log?: boolean; extra?: Record<string, string> };

const QUICK: Record<"message" | "call", Quick[]> = {
  message: [
    { label: "Sent", hint: "Follow up in 3 days", outcome: "Sent", days: 3 },
    { label: "Replied or talked", hint: "Note what they said", outcome: "Replied", days: 3, log: true },
    { label: "Demo booked", hint: "Moves to Discovery done", outcome: "Demo booked", days: 3 },
    { label: "Not interested", hint: "Moves to Lost", outcome: "Not interested", days: null },
    { label: "Wrong number", hint: "Back to research", outcome: "Wrong number", days: 2, extra: { research_status: "Needs a person" } },
  ],
  call: [
    { label: "Talked", hint: "Note what they said", outcome: "Connected", days: 3, log: true },
    { label: "No answer", hint: "Try another channel tomorrow", outcome: "No answer", days: 1 },
    { label: "Call back later", hint: "Retry tomorrow", outcome: "Busy — call back", days: 1 },
    { label: "Demo booked", hint: "Moves to Discovery done", outcome: "Demo booked", days: 3 },
    { label: "Not interested", hint: "Moves to Lost", outcome: "Not interested", days: null },
    { label: "Wrong number", hint: "Back to research", outcome: "Wrong number", days: 2, extra: { research_status: "Needs a person" } },
  ],
};

const GROUPS = [
  { reason: "overdue", title: "Overdue" },
  { reason: "today", title: "Due today" },
  { reason: "new", title: "First contact" },
] as const;

function digits10(phone: string): string | null {
  const d = phone.replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
}

/** Today: the person's queue on the left, one prospect at a time on the right. */
export function MyWork({ rows, today, me, onOpen, onLog, onChanged, onFind }: { rows: ProspectRow[]; today: string; me: string; onOpen: (r: ProspectRow) => void; onLog: (r: ProspectRow, o?: LogOpts) => void; onChanged: () => void; onFind: () => void }) {
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const all = useMemo(() => myTasks(rows, me, today), [rows, me, today]);
  const tasks = useMemo(() => [...all.filter((t) => !skipped.has(`${t.row.kind}:${t.row.id}`)), ...all.filter((t) => skipped.has(`${t.row.kind}:${t.row.id}`))], [all, skipped]);
  const [selId, setSelId] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  // null follows the record: the first channel research wrote a draft for.
  const [picked, setTab] = useState<DraftKey | null>(null);
  const [pending, start] = useTransition();
  const cardRef = useRef<HTMLElement>(null);
  const current = tasks.find((t) => `${t.row.kind}:${t.row.id}` === selId) ?? tasks[0];
  const detail = useDetail(current ? { kind: current.row.kind, id: current.row.id } : null);
  const r = detail.data?.record;
  const tab: DraftKey = picked ?? DRAFT_TABS.find((d) => r?.drafts[d.key])?.key ?? "whatsapp";
  const first = me.split(/\s+/)[0];
  const total = tasks.length + done;

  if (!tasks.length) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
        <h2 className="text-lg font-semibold">{done ? `All done, ${first}` : `Nothing due for ${first}`}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {done ? `${done} logged this session. ` : ""}Today fills with follow-ups assigned to you that are due, plus A-band valuers of yours nobody has contacted yet.
        </p>
        <Button variant="outline" onClick={onFind}>
          Pick up A-band prospects
        </Button>
      </div>
    );
  }

  const select = (key: string) => {
    setSelId(key);
    setTab(null);
    if (window.matchMedia("(max-width: 1023px)").matches) cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const advance = () => {
    const next = tasks.find((t) => t !== current);
    setSelId(next ? `${next.row.kind}:${next.row.id}` : null);
    setTab(null);
  };
  const tabInfo = DRAFT_TABS.find((d) => d.key === tab)!;
  const channel: Channel = tabInfo.channel;
  const quicks = QUICK[channel === "Call" ? "call" : "message"].filter((q) => q.outcome !== "Wrong number" || channel !== "Email");

  const quick = (q: Quick) => {
    if (!current) return;
    const row = current.row;
    if (q.log) return onLog(row, { channel, outcome: q.outcome });
    start(async () => {
      const stage = defaultStage(row.stage, channel, q.outcome);
      const res = await logTouch({
        kind: row.kind,
        id: row.id,
        name: row.name,
        channel,
        direction: "Outbound",
        outcome: q.outcome,
        durationMin: null,
        summary: "",
        statusAfter: STAGES[stage],
        nextStep: defaultNextStep(q.outcome, row.nextStep) || null,
        nextStepDate: q.days === null ? null : addDays(today, q.days),
      });
      if (res.ok && q.extra && row.kind === "valuer") await saveProspect(row.kind, row.id, q.extra);
      if (res.ok) {
        toast.success(res.message);
        setDone((n) => n + 1);
        advance();
        onChanged();
      } else toast.error(res.message);
    });
  };

  const draft = r?.drafts[tab] ?? "";
  const phone = r ? digits10(r.phone) : null;
  const openHref = !r
    ? null
    : tab === "whatsapp" && phone
      ? `https://wa.me/91${phone}?text=${encodeURIComponent(draft)}`
      : tab === "email" && r.email
        ? `mailto:${r.email}?body=${encodeURIComponent(draft.replace(/^Subject:.*\n+/, ""))}&subject=${encodeURIComponent(draft.match(/^Subject:\s*(.+)/)?.[1] ?? "")}`
        : tab === "call" && phone
          ? `tel:+91${phone}`
          : null;
  const missing = r ? [r.software ? null : "Software unknown", r.casesPerMonth === null && r.kind === "valuer" ? "Volume unknown" : null, phone ? null : "No phone"].filter(Boolean) : [];

  return (
    <div className="-mx-3 -my-3 grid min-h-full sm:-mx-6 sm:-my-5 lg:grid-cols-[340px_minmax(0,1fr)]">
      <section aria-label="Your queue" className="flex flex-col border-b px-3 py-4 lg:border-r lg:border-b-0">
        <div className="flex flex-col gap-2 px-2 pb-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold">Your day</h2>
            <span className="text-[13px] text-muted-foreground">
              {done} of {total} done
            </span>
          </div>
          <div className="h-1 rounded-full bg-muted">
            <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
        </div>
        {GROUPS.map((g) => {
          const items = tasks.filter((t) => t.reason === g.reason);
          if (!items.length) return null;
          return (
            <div key={g.reason} className="flex flex-col">
              <h3 className="px-2 pt-3 pb-1.5 text-xs font-medium text-muted-foreground">
                {g.title} <span className="font-mono">{items.length}</span>
              </h3>
              {items.map((t) => {
                const key = `${t.row.kind}:${t.row.id}`;
                const on = t === current;
                return (
                  <button key={key} type="button" onClick={() => select(key)} className={cn("flex items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/60", on && "bg-muted hover:bg-muted", skipped.has(key) && "opacity-50")}>
                    <span className="size-3.5 shrink-0 rounded-full shadow-[inset_0_0_0_1.5px_var(--muted-foreground)]" />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium">{t.row.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{t.reason === "new" ? t.row.pitchAngle || t.row.city || t.row.state || "First message" : t.row.nextStep || "Follow up"}</span>
                    </span>
                    {t.reason === "new" ? <span className="font-mono text-[10px] text-muted-foreground uppercase">{t.row.kind.slice(0, 3)}</span> : <DueChip date={t.row.nextStepDate} today={today} />}
                  </button>
                );
              })}
            </div>
          );
        })}
      </section>

      {current && (
        <section ref={cardRef} aria-label="Current prospect" className={cn("flex max-w-3xl min-w-0 scroll-mt-3 flex-col gap-6 px-4 py-5 max-lg:order-first sm:px-8 sm:py-6", detail.loading && "opacity-70")}>
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-[13px] text-muted-foreground">
                {KIND_LABEL[current.row.kind].one}
                {current.row.city ? ` · ${current.row.city}` : ""} · {STAGES[current.row.stage]}
              </span>
              <h2 className="text-2xl font-semibold tracking-tight">{current.row.name}</h2>
              {r && (
                <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                  {r.lenders.length > 0 && <span className="rounded-md bg-muted px-2 py-1">{r.lenders.slice(0, 3).join(" · ")}</span>}
                  {r.software && <span className="rounded-md bg-muted px-2 py-1">{r.software}</span>}
                  {r.casesPerMonth !== null && <span className="rounded-md bg-muted px-2 py-1">{r.casesPerMonth} cases / month</span>}
                  {missing.map((m) => (
                    <span key={m} className="rounded-md bg-amber-50 px-2 py-1 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                      {m}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-1.5">
              <Button variant="outline" onClick={() => onOpen(current.row)}>
                Open record
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setSkipped((s) => new Set(s).add(`${current.row.kind}:${current.row.id}`));
                  advance();
                }}
              >
                Skip
              </Button>
            </div>
          </div>

          {(current.row.nextStep || current.row.pitchAngle) && (
            <div className="flex items-start gap-2.5 rounded-lg bg-muted/60 px-3.5 py-3 text-sm leading-snug">
              <span className="shrink-0 rounded-md bg-background px-2 py-0.5 text-xs shadow-[0_0_0_1px_var(--border)]">{current.reason === "new" ? "First contact" : "Next step"}</span>
              <span>{current.row.nextStep || `Lead with: ${current.row.pitchAngle}`}</span>
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Segmented label="Draft" value={tab} onChange={setTab} options={DRAFT_TABS.map((d) => ({ value: d.key, label: d.label }))} />
              <span className="flex-1" />
              <span className="text-xs text-muted-foreground max-sm:hidden">Drafted by research · edit before sending</span>
            </div>
            <div className="min-h-32 rounded-lg border px-4 py-3.5 text-sm leading-relaxed whitespace-pre-wrap">
              {draft || <span className="text-muted-foreground">No {tabInfo.label === "Call script" ? "call script" : `${tabInfo.label} draft`} yet. Research writes one per record; you can also write one from the record.</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {openHref && (
                <a href={openHref} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-3.5 text-sm font-medium text-background hover:bg-foreground/85 sm:h-8">
                  {tab === "call" ? (
                    <>
                      <Phone className="size-3.5" /> Call now
                    </>
                  ) : (
                    `Open in ${tab === "email" ? "Mail" : "WhatsApp"}`
                  )}
                </a>
              )}
              {draft && (
                <Button variant="outline" className="h-9 sm:h-8" onClick={() => navigator.clipboard.writeText(draft).then(() => toast.success("Draft copied"))}>
                  <Copy /> Copy
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-1">
              <h3 className="text-sm font-semibold">How did it go?</h3>
              <span className="text-xs text-muted-foreground">One click logs it, sets the follow-up and moves you on</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {quicks.map((q) => (
                <button key={q.label} type="button" disabled={pending} onClick={() => quick(q)} className="flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted disabled:opacity-50">
                  <span className="text-[13px] font-medium">{q.label}</span>
                  <span className="text-xs text-muted-foreground">{q.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
