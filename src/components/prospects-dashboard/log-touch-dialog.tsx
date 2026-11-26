"use client";

import { Mail, MessageCircle, Phone, Users } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ThemeField, useProductFeedback } from "@/components/product/send-to-product";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { logTouch } from "@/lib/prospects/actions";
import { CHANNELS, OBJECTIONS, PITCH_ANGLES, STAGES, WRITABLE, type Channel, type Outcome, type ProspectKind } from "@/lib/prospects/schema";
import { SOFTWARE } from "@/lib/prospects/contact";
import { addDays } from "@/lib/prospects/stats";
import { needsSummary } from "@/lib/prospects/touch";
import { touchContact, touchSource, touchSourceRef } from "@/lib/send-to-product";
import { sendToProduct } from "@/lib/send-to-product-actions";
import { cn } from "@/lib/utils";
import { Chips, DatePicker, LinkedInGlyph, shortDate, StageDot } from "./bits";

export type LogTarget = { kind: ProspectKind; id: string; name: string; stage: number; nextStep: string; channel?: Channel; outcome?: Outcome };

/** The outcomes that make sense for each channel, most likely first. */
const OUTCOMES_BY_CHANNEL: Record<Channel, Outcome[]> = {
  Call: ["Connected", "No answer", "Busy — call back", "Demo booked", "Not interested", "Wrong number"],
  WhatsApp: ["Sent", "Replied", "Demo booked", "Not interested", "Wrong number"],
  Email: ["Sent", "Replied", "Demo booked", "Not interested"],
  LinkedIn: ["Sent", "Replied", "Connected", "Demo booked", "Not interested"],
  Meeting: ["Meeting held", "Demo booked", "Not interested"],
  Other: ["Sent", "Replied", "Connected", "Not interested"],
};

const FOLLOW_UPS = [
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "Next week", days: 7 },
] as const;


/** Where an outcome usually leaves a record — a default the caller can change. */
export function defaultStage(stage: number, channel: Channel, outcome: Outcome): number {
  if (outcome === "Not interested") return 6;
  if (outcome === "Demo booked" || outcome === "Meeting held") return Math.max(stage, 2);
  if (outcome === "Connected" && (channel === "Call" || channel === "Meeting")) return Math.max(stage, 2);
  return Math.max(stage, 1);
}

export function defaultNextStep(outcome: Outcome, current: string): string {
  if (outcome === "Demo booked") return "Run the demo";
  if (outcome === "No answer" || outcome === "Busy — call back") return "Try again on another channel";
  if (outcome === "Sent") return "Follow up if no reply";
  if (outcome === "Not interested") return "";
  return current || "Follow up";
}

/**
 * Log a call, message or meeting. Everything is on one screen: what happened
 * on the left, what happens next on the right, and what was learnt below.
 * Nothing is folded away, so the stage a save moves the record to is always
 * in view before Save.
 */
export function LogTouchDialog({ target, today, open, onOpenChange, onSaved, title = "Log a touch" }: { target: LogTarget | null; today: string; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void; title?: string }) {
  if (!target) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
        {/* Keyed so each record starts from a clean form. */}
        <LogForm key={`${target.kind}:${target.id}:${target.channel ?? ""}:${target.outcome ?? ""}`} target={target} today={today} title={title} onDone={() => onOpenChange(false)} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: React.ReactNode }) {
  const head = (
    <>
      {label}
      {hint && <span className="font-normal text-muted-foreground"> · {hint}</span>}
    </>
  );
  return (
    <div className="flex flex-col gap-2">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-xs font-medium text-foreground/80">
          {head}
        </label>
      ) : (
        <span className="text-xs font-medium text-foreground/80">{head}</span>
      )}
      {children}
    </div>
  );
}

/** A titled block of the form; the number keeps the order clear when the columns stack on a phone. */
function Block({ n, title, children, className }: { n: number; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn("flex min-w-0 flex-col gap-4", className)}>
      <h3 className="flex items-center gap-2 text-[13px] font-semibold">
        <span className="grid size-5 place-items-center rounded-full bg-muted font-mono text-[11px] text-muted-foreground">{n}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

const CHANNEL_ICON: Partial<Record<Channel, React.ReactNode>> = {
  Call: <Phone className="size-3.5" />,
  WhatsApp: <MessageCircle className="size-3.5" />,
  Email: <Mail className="size-3.5" />,
  LinkedIn: <LinkedInGlyph className="size-3.5" />,
  Meeting: <Users className="size-3.5" />,
};

/** Minutes only mean something when you spoke. */
const TIMED: Channel[] = ["Call", "Meeting"];

function LogForm({ target, today, title, onDone, onSaved }: { target: LogTarget; today: string; title: string; onDone: () => void; onSaved: () => void }) {
  const [channel, setChannelState] = useState<Channel>(target.channel ?? "Call");
  const [outcome, setOutcome] = useState<Outcome>(target.outcome ?? OUTCOMES_BY_CHANNEL[target.channel ?? "Call"][0]);
  const [summary, setSummary] = useState("");
  const [followDate, setFollowDate] = useState<string | null>(addDays(today, 3));
  const [nextStep, setNextStep] = useState<string | null>(null);
  const [minutes, setMinutes] = useState("");
  const [software, setSoftware] = useState("");
  const [cases, setCases] = useState("");
  const [objection, setObjection] = useState("");
  const [pitch, setPitch] = useState("");
  const [stageOverride, setStageOverride] = useState<number | null>(null);
  const [toProduct, setToProduct] = useState(false);
  const [theme, setTheme] = useState("");
  const [pending, start] = useTransition();
  // Only read Product's themes once someone asks to send there.
  const fb = useProductFeedback({ enabled: toProduct });

  const setChannel = (c: Channel) => {
    setChannelState(c);
    if (!OUTCOMES_BY_CHANNEL[c].includes(outcome)) setOutcome(OUTCOMES_BY_CHANNEL[c][0]);
  };
  const suggested = defaultStage(target.stage, channel, outcome);
  const stage = stageOverride ?? suggested;
  const step = nextStep ?? defaultNextStep(outcome, target.nextStep);
  const tracksPitch = WRITABLE[target.kind].has("pitch_angle");
  const tracksPractice = target.kind === "valuer";
  const learns = tracksPractice || tracksPitch;
  const quickLabel = FOLLOW_UPS.find((f) => addDays(today, f.days) === followDate)?.label ?? "";
  const timed = TIMED.includes(channel);
  const summaryNeeded = needsSummary(outcome);
  const missingSummary = summaryNeeded && summary.trim() === "";

  const submit = () =>
    start(async () => {
      const res = await logTouch({
        kind: target.kind,
        id: target.id,
        name: target.name,
        channel,
        direction: outcome === "Replied" ? "Inbound" : "Outbound",
        outcome,
        durationMin: timed && minutes ? Number(minutes) : null,
        summary: summary.trim(),
        statusAfter: STAGES[stage],
        nextStep: followDate ? step || null : null,
        nextStepDate: followDate,
        fields: {
          ...(tracksPractice && software ? { current_software: software } : {}),
          ...(tracksPractice && cases ? { lb_cases_per_month: Number(cases) } : {}),
          ...(tracksPitch && objection ? { objections: objection } : {}),
          ...(tracksPitch && pitch ? { pitch_angle: pitch } : {}),
        },
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      const said = summary.trim();
      if (toProduct && said && fb.ctx && res.activityId) {
        // The touch is saved either way; a send that fails says so and can be retried from the record.
        try {
          await sendToProduct({
            projectId: fb.ctx.projectId,
            body: said,
            contact: touchContact(target.name, stage),
            source: touchSource(stage),
            sourceRef: touchSourceRef(target.kind, target.id, { id: res.activityId, date: null, loggedAt: "", summary: said }),
            theme,
          });
          toast.success("Sent to Product");
        } catch {
          toast.error("The touch is saved, but it didn't reach Product. Send it from the record's activity.");
        }
      }
      onSaved();
      onDone();
    });

  const pill = (on: boolean) => cn("h-8 rounded-md border px-2.5 text-[13px] whitespace-nowrap hover:bg-muted sm:h-7", on && "border-foreground bg-foreground text-background hover:bg-foreground");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending && !missingSummary) submit();
      }}
      onKeyDown={(e) => {
        // ⌘/Ctrl+Enter saves from anywhere in the form, the notes box included.
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !pending && !missingSummary) {
          e.preventDefault();
          submit();
        }
      }}
    >
      <DialogHeader className="gap-0.5 border-b px-5 pt-5 pb-4">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="flex flex-wrap items-center gap-x-1.5">
          {target.name} · now <StageDot stage={target.stage} /> {STAGES[target.stage]}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-x-8 gap-y-6 px-5 py-5 md:grid-cols-2">
        <Block n={1} title="What happened">
          <Field label="Channel">
            <div role="radiogroup" aria-label="Channel" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-0.5 sm:grid-cols-5">
              {CHANNELS.filter((c) => c !== "Other").map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={c === channel}
                  onClick={() => setChannel(c)}
                  className={cn("inline-flex h-8 items-center justify-center gap-1.5 rounded-md text-[13px]", c === channel ? "bg-background font-medium shadow-xs" : "text-muted-foreground hover:text-foreground")}
                >
                  {CHANNEL_ICON[c]}
                  {c}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Outcome">
            <Chips label="Outcome" value={outcome} options={OUTCOMES_BY_CHANNEL[channel]} onChange={(v) => v && setOutcome(v)} />
          </Field>
          {timed && (
            <Field label="Minutes" hint="optional" htmlFor="log-min">
              <Input id="log-min" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 12" className="h-8 w-24" />
            </Field>
          )}
          <Field label="What they said" hint={summaryNeeded ? "required" : "optional"} htmlFor="log-sum">
            <Textarea
              id="log-sum"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              placeholder="e.g. Works with 4 banks; the SBI format takes longest. Wants to see it on a live case."
              className="resize-none text-sm leading-relaxed"
            />
            <label htmlFor="log-product" className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
              <input id="log-product" type="checkbox" checked={toProduct} onChange={(e) => setToProduct(e.target.checked)} className="size-4 shrink-0 accent-[var(--brand)]" />
              Also send what they said to Product
            </label>
            {toProduct && (fb.ctx ? <ThemeField value={theme} onChange={setTheme} themes={fb.ctx.themes} /> : <p className="text-xs text-muted-foreground">Finding Product&apos;s themes…</p>)}
          </Field>
        </Block>

        <Block n={2} title="What's next">
          <Field label="Stage after" hint={stageOverride === null ? "suggested from the outcome" : "your choice"}>
            <div role="radiogroup" aria-label="Stage after" className="flex flex-wrap gap-1.5">
              {STAGES.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={i === stage}
                  onClick={() => setStageOverride(i === suggested ? null : i)}
                  className={cn("inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] whitespace-nowrap sm:h-7", i === stage ? "border-foreground bg-foreground text-background" : "hover:bg-muted", i === 6 && "max-md:basis-full max-md:justify-center md:ml-auto")}
                >
                  <StageDot stage={i} />
                  {s}
                  {i === suggested && i !== stage && <span className="text-[11px] text-muted-foreground">suggested</span>}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Follow up">
            <div className="flex flex-wrap gap-1.5">
              <Chips label="Follow up" value={quickLabel as (typeof FOLLOW_UPS)[number]["label"] | ""} options={FOLLOW_UPS.map((f) => f.label)} onChange={(v) => setFollowDate(v ? addDays(today, FOLLOW_UPS.find((f) => f.label === v)!.days) : null)} />
              <DatePicker value={followDate} today={today} onPick={setFollowDate} allowClear={false}>
                <button type="button" className={pill(Boolean(followDate && !quickLabel))}>
                  {followDate && !quickLabel ? shortDate(followDate, today) : "Pick a date"}
                </button>
              </DatePicker>
              <button type="button" aria-pressed={!followDate} onClick={() => setFollowDate(null)} className={pill(!followDate)}>
                No follow-up
              </button>
            </div>
          </Field>
          <Field label="Next step" hint={followDate ? `on ${shortDate(followDate, today)}` : "needs a follow-up date"} htmlFor="log-next">
            <Input id="log-next" value={followDate ? step : ""} disabled={!followDate} placeholder={followDate ? "What happens next" : "Pick a follow-up date to set one"} onChange={(e) => setNextStep(e.target.value)} className="h-8" />
          </Field>
        </Block>

        {learns && (
          <Block n={3} title="What you learned" className="border-t pt-5 md:col-span-2">
            <p className="-mt-2 text-xs text-muted-foreground">Fill only what came up. Each one saves to the record and fills a gap the stage asks for.</p>
            <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
              {tracksPractice && (
                <>
                  <Field label="Current software">
                    <Chips label="Current software" value={software} options={SOFTWARE} onChange={setSoftware} allowNone />
                  </Field>
                  <Field label="Cases a month" htmlFor="log-cases">
                    <Input id="log-cases" inputMode="numeric" value={cases} onChange={(e) => setCases(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 40" className="h-8 w-28" />
                  </Field>
                </>
              )}
              {tracksPitch && (
                <>
                  <Field label="Main objection">
                    <Chips label="Main objection" value={objection} options={OBJECTIONS} onChange={setObjection} allowNone />
                  </Field>
                  <Field label="Pitch that landed">
                    <Chips label="Pitch that landed" value={pitch} options={PITCH_ANGLES} onChange={setPitch} allowNone />
                  </Field>
                </>
              )}
            </div>
          </Block>
        )}
      </div>

      <div className="sticky bottom-0 flex flex-col gap-3 border-t bg-background px-5 py-3 sm:flex-row sm:items-center">
        <p className="flex flex-1 flex-wrap items-center gap-x-1.5 text-xs leading-relaxed text-muted-foreground">
          {stage === target.stage ? "Stays at" : "Moves to"}
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <StageDot stage={stage} /> {STAGES[stage]}
          </span>
          <span aria-hidden>·</span>
          {followDate ? `${step ? `“${step}”` : "Follow up"} on ${shortDate(followDate, today)}` : "No follow-up"}
        </p>
        <div className="flex items-center justify-end gap-2">
          <kbd className="font-mono text-[11px] text-muted-foreground max-sm:hidden">⌘↵</kbd>
          <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || missingSummary} title={missingSummary ? "Write what they said first" : undefined}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </form>
  );
}
