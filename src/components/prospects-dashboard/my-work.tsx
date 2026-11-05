"use client";

import { Copy, Phone } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { logTouch, saveProspect } from "@/lib/prospects/actions";
import { KIND_LABEL, STAGES, WRITABLE, type Channel, type Outcome } from "@/lib/prospects/schema";
import { addDays, myTasks, type ProspectRow } from "@/lib/prospects/stats";
import { tone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { DueChip, KIND_TONE, KindDot, outcomeTone, Segmented, StageDot, StagePill } from "./bits";

/** Overdue red, due today amber, first contact blue — the same tones as the due chips. */
const GROUP_DOT: Record<string, string> = { overdue: tone("red").dot, today: tone("amber").dot, new: tone("blue").dot };
import { defaultNextStep, defaultStage } from "./log-touch-dialog";
import { useDetail, type LogOpts } from "./record";
import { fillTemplate, GENERAL_ANGLE, TEMPLATE_ANGLES } from "./templates";

const DRAFT_TABS = [
  { key: "whatsapp", label: "WhatsApp", channel: "WhatsApp", col: "draft_whatsapp" },
  { key: "call", label: "Call script", channel: "Call", col: "draft_call" },
  { key: "email", label: "Email", channel: "Email", col: "draft_email" },
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
export function MyWork({ rows, today, me, onOpen, onLog, onChanged, onFind, onShareOut }: { rows: ProspectRow[]; today: string; me: string; onOpen: (r: ProspectRow) => void; onLog: (r: ProspectRow, o?: LogOpts) => void; onChanged: () => void; onFind: () => void; onShareOut: () => void }) {
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const all = useMemo(() => myTasks(rows, me, today), [rows, me, today]);
  const tasks = useMemo(() => [...all.filter((t) => !skipped.has(`${t.row.kind}:${t.row.id}`)), ...all.filter((t) => skipped.has(`${t.row.kind}:${t.row.id}`))], [all, skipped]);
  const [selId, setSelId] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  // null follows the record: the first channel research wrote a draft for.
  const [picked, setTab] = useState<DraftKey | null>(null);
  // A starter message chosen for a prospect research wrote no draft for; null shows the picker.
  const [angle, setAngle] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const cardRef = useRef<HTMLElement>(null);
  const current = tasks.find((t) => `${t.row.kind}:${t.row.id}` === selId) ?? tasks[0];
  const detail = useDetail(current ? { kind: current.row.kind, id: current.row.id } : null);
  const r = detail.data?.record;
  const tab: DraftKey = picked ?? DRAFT_TABS.find((d) => r?.drafts[d.key])?.key ?? "whatsapp";
  const first = me.split(/\s+/)[0];
  const total = tasks.length + done;

  const select = (key: string) => {
    setSelId(key);
    setTab(null);
    setAngle(null);
    if (window.matchMedia("(max-width: 1023px)").matches) cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const advance = () => {
    const next = tasks.find((t) => t !== current);
    setSelId(next ? `${next.row.kind}:${next.row.id}` : null);
    setTab(null);
    setAngle(null);
  };
  const skip = () => {
    if (!current) return;
    setSkipped((s) => new Set(s).add(`${current.row.kind}:${current.row.id}`));
    advance();
  };
  const tabInfo = DRAFT_TABS.find((d) => d.key === tab)!;
  const ownDraft = r?.drafts[tab] ?? "";
  const pickedAngle = angle ?? (r?.pitchAngle && TEMPLATE_ANGLES.includes(r.pitchAngle) ? r.pitchAngle : null);
  const templated = !ownDraft && r && pickedAngle ? fillTemplate(pickedAngle, tab, { kind: r.kind, name: r.name, city: r.city, lenders: r.lenders }, me) : "";
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

  const draft = ownDraft || templated;
  const saveTemplate = () =>
    r &&
    start(async () => {
      const res = await saveProspect(r.kind, r.id, { [tabInfo.col]: templated });
      if (res.ok) {
        toast.success("Saved as the draft");
        detail.reload();
      } else toast.error(res.message);
    });

  // Keys for working the queue without the mouse; ignored while typing or with a dialog open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable || document.querySelector("[role=dialog]")) return;
      if (!current) return;
      const n = Number(e.key);
      if (n >= 1 && n <= quicks.length && !pending) quick(quicks[n - 1]);
      else if (e.key === "j" || e.key === "k") {
        const i = tasks.indexOf(current);
        const next = tasks[Math.min(Math.max(i + (e.key === "j" ? 1 : -1), 0), tasks.length - 1)];
        if (next) select(`${next.row.kind}:${next.row.id}`);
      } else if (e.key === "s") skip();
      else if (e.key === "o") onOpen(current.row);
      else if (e.key === "l") onLog(current.row, { channel });
      else if (e.key === "c" && draft) navigator.clipboard.writeText(draft).then(() => toast.success("Draft copied"));
      else if (e.key === "t") setTab(DRAFT_TABS[(DRAFT_TABS.findIndex((d) => d.key === tab) + 1) % DRAFT_TABS.length].key);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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
  if (!tasks.length) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
        <h2 className="text-lg font-semibold">{done ? `All done, ${first}` : `Nothing due for ${first}`}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {done ? `${done} logged this session. ` : ""}Today fills with follow-ups assigned to you that are due, plus A-band valuers of yours nobody has contacted yet.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={onShareOut}>Share out prospects</Button>
          <Button variant="outline" onClick={onFind}>
            Browse A-band valuers
          </Button>
        </div>
      </div>
    );
  }

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
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
        </div>
        {GROUPS.map((g) => {
          const items = tasks.filter((t) => t.reason === g.reason);
          if (!items.length) return null;
          return (
            <div key={g.reason} className="flex flex-col">
              <h3 className="flex items-center gap-1.5 px-2 pt-3 pb-1.5 text-xs font-medium text-muted-foreground">
                <span aria-hidden className={cn("size-1.5 rounded-full", GROUP_DOT[g.reason])} />
                {g.title} <span className="font-mono">{items.length}</span>
              </h3>
              {items.map((t) => {
                const key = `${t.row.kind}:${t.row.id}`;
                const on = t === current;
                return (
                  <button key={key} type="button" onClick={() => select(key)} className={cn("press relative flex items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-muted/60", on && "bg-muted hover:bg-muted", skipped.has(key) && "opacity-50")}>
                    {on && <span aria-hidden className="animate-fade absolute inset-y-2 -left-1 w-0.5 rounded-full bg-brand" />}
                    <StageDot stage={t.row.stage} className="size-2.5" />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium">{t.row.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{t.reason === "new" ? t.row.pitchAngle || t.row.city || t.row.state || "First message" : t.row.nextStep || "Follow up"}</span>
                    </span>
                    {t.reason === "new" ? <span className={cn("font-mono text-[10px] font-medium uppercase", tone(KIND_TONE[t.row.kind]).text)}>{t.row.kind.slice(0, 3)}</span> : <DueChip date={t.row.nextStepDate} today={today} />}
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
              <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-muted-foreground">
                <KindDot kind={current.row.kind} />
                {KIND_LABEL[current.row.kind].one}
                {current.row.city ? ` · ${current.row.city}` : ""}
                <StagePill stage={current.row.stage} className="ml-1" />
              </span>
              <h2 className="text-2xl font-semibold tracking-tight">{current.row.name}</h2>
              {r && (
                <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                  {r.lenders.length > 0 && <span className="rounded-md bg-muted px-2 py-1">{r.lenders.slice(0, 3).join(" · ")}</span>}
                  {r.software && <span className="rounded-md bg-muted px-2 py-1">{r.software}</span>}
                  {r.casesPerMonth !== null && <span className="rounded-md bg-muted px-2 py-1">{r.casesPerMonth} cases / month</span>}
                  {missing.map((m) => (
                    <span key={m} className={cn("rounded-md px-2 py-1", tone("amber").chip)}>
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
              <Button variant="ghost" onClick={skip}>
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
              <Segmented
                label="Draft"
                value={tab}
                onChange={(v) => {
                  setTab(v);
                  setAngle(null);
                }}
                options={DRAFT_TABS.map((d) => ({ value: d.key, label: d.label }))}
              />
              <span className="flex-1" />
              <span className="text-xs text-muted-foreground max-sm:hidden">{ownDraft ? "Drafted by research · edit before sending" : templated ? `Template · ${pickedAngle}` : ""}</span>
            </div>
            {!ownDraft && r && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="mr-1 text-muted-foreground">{templated ? "Other templates:" : "No draft yet. Start from a template:"}</span>
                {TEMPLATE_ANGLES.map((a) => (
                  <button key={a} type="button" aria-pressed={a === pickedAngle} onClick={() => setAngle(a)} className={cn("h-7 rounded-md border px-2 whitespace-nowrap", a === pickedAngle ? "border-foreground bg-foreground text-background" : "hover:bg-muted")}>
                    {a === GENERAL_ANGLE ? "Discovery (any)" : a}
                  </button>
                ))}
              </div>
            )}
            {(ownDraft || templated) && (
              <div className={cn("min-h-32 rounded-lg border px-4 py-3.5 text-sm leading-relaxed whitespace-pre-wrap", !ownDraft && "border-dashed")}>{draft}</div>
            )}
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
              {templated && r && WRITABLE[r.kind].has(tabInfo.col) && (
                <Button variant="ghost" className="h-9 sm:h-8" disabled={pending} onClick={saveTemplate}>
                  Save as the draft
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
                <button key={q.label} type="button" disabled={pending} onClick={() => quick(q)} className="hover-lift press flex flex-col items-start gap-0.5 rounded-lg border bg-card px-3 py-2.5 text-left hover:border-foreground/20 disabled:opacity-50">
                  <span className="flex w-full items-center gap-2 text-[13px] font-medium">
                    <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", tone(outcomeTone(q.outcome)).dot)} />
                    <span className="flex-1">{q.label}</span>
                    <kbd className="font-mono text-[10px] font-normal text-muted-foreground/70 max-lg:hidden">{quicks.indexOf(q) + 1}</kbd>
                  </span>
                  <span className="text-xs text-muted-foreground">{q.hint}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground max-lg:hidden">
              Keys: <kbd className="font-mono">1</kbd>–<kbd className="font-mono">{quicks.length}</kbd> how it went · <kbd className="font-mono">J</kbd>/<kbd className="font-mono">K</kbd> next or previous · <kbd className="font-mono">S</kbd> skip · <kbd className="font-mono">T</kbd> switch draft · <kbd className="font-mono">C</kbd> copy · <kbd className="font-mono">L</kbd> log with notes · <kbd className="font-mono">O</kbd> open record
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
