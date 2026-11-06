"use client";

import { ChevronRight } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ThemeField, useProductFeedback } from "@/components/product/send-to-product";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { logTouch } from "@/lib/prospects/actions";
import { CHANNELS, OBJECTIONS, PITCH_ANGLES, STAGES, WRITABLE, type Channel, type Outcome, type ProspectKind } from "@/lib/prospects/schema";
import { addDays } from "@/lib/prospects/stats";
import { touchContact, touchSource, touchSourceRef } from "@/lib/send-to-product";
import { sendToProduct } from "@/lib/send-to-product-actions";
import { cn } from "@/lib/utils";
import { Chips, DatePicker, Segmented, shortDate } from "./bits";

export type LogTarget = { kind: ProspectKind; id: string; name: string; stage: number; nextStep: string; channel?: Channel; outcome?: Outcome };

/** The outcomes that make sense for each channel, most likely first. */
const OUTCOMES_BY_CHANNEL: Record<Channel, Outcome[]> = {
  Call: ["Connected", "No answer", "Busy — call back", "Demo booked", "Not interested", "Wrong number"],
  WhatsApp: ["Sent", "Replied", "Demo booked", "Not interested", "Wrong number"],
  Email: ["Sent", "Replied", "Demo booked", "Not interested"],
  Meeting: ["Meeting held", "Demo booked", "Not interested"],
  Other: ["Sent", "Replied", "Connected", "Not interested"],
};

const FOLLOW_UPS = [
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "Next week", days: 7 },
] as const;

const SOFTWARE = ["Word + Excel", "Word templates", "Own software", "Bank's portal", "Another tool"];

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

/** Log a call, message or meeting: short by default, with what was learnt one click away. */
export function LogTouchDialog({ target, today, open, onOpenChange, onSaved, title = "Log a touch" }: { target: LogTarget | null; today: string; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void; title?: string }) {
  if (!target) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-xl">
        {/* Keyed so each record starts from a clean form. */}
        <LogForm key={`${target.kind}:${target.id}:${target.channel ?? ""}:${target.outcome ?? ""}`} target={target} today={today} title={title} onDone={() => onOpenChange(false)} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-xs font-medium text-foreground/80">
          {label}
        </label>
      ) : (
        <span className="text-xs font-medium text-foreground/80">{label}</span>
      )}
      {children}
    </div>
  );
}

function LogForm({ target, today, title, onDone, onSaved }: { target: LogTarget; today: string; title: string; onDone: () => void; onSaved: () => void }) {
  const [channel, setChannelState] = useState<Channel>(target.channel ?? "Call");
  const [outcome, setOutcome] = useState<Outcome>(target.outcome ?? OUTCOMES_BY_CHANNEL[target.channel ?? "Call"][0]);
  const [summary, setSummary] = useState("");
  const [followDate, setFollowDate] = useState<string | null>(addDays(today, 3));
  const [nextStep, setNextStep] = useState<string | null>(null);
  const [more, setMore] = useState(false);
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
  const stage = stageOverride ?? defaultStage(target.stage, channel, outcome);
  const step = nextStep ?? defaultNextStep(outcome, target.nextStep);
  const tracksPitch = WRITABLE[target.kind].has("pitch_angle");
  const tracksPractice = target.kind === "valuer";
  const quickLabel = FOLLOW_UPS.find((f) => addDays(today, f.days) === followDate)?.label ?? "";

  const submit = () =>
    start(async () => {
      const res = await logTouch({
        kind: target.kind,
        id: target.id,
        name: target.name,
        channel,
        direction: outcome === "Replied" ? "Inbound" : "Outbound",
        outcome,
        durationMin: minutes ? Number(minutes) : null,
        summary: summary.trim(),
        statusAfter: STAGES[stage],
        nextStep: step || null,
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

  return (
    <>
      <DialogHeader className="gap-0.5 px-5 pt-5 pb-1">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          {target.name} · {STAGES[target.stage]}
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-5 px-5 pt-3 pb-5">
        <Field label="How">
          <Segmented label="Channel" value={channel} onChange={setChannel} options={CHANNELS.filter((c) => c !== "Other").map((c) => ({ value: c, label: c }))} className="self-start" />
        </Field>
        <Field label="What happened">
          <Chips label="Outcome" value={outcome} options={OUTCOMES_BY_CHANNEL[channel]} onChange={(v) => v && setOutcome(v)} />
        </Field>
        <Field label="What they said" htmlFor="log-sum">
          <textarea
            id="log-sum"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            placeholder="e.g. Works with 4 banks; the SBI format takes longest. Wants to see it on a live case."
            className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <label htmlFor="log-product" className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
            <input id="log-product" type="checkbox" checked={toProduct} onChange={(e) => setToProduct(e.target.checked)} className="size-4 shrink-0 accent-primary" />
            Also send what they said to Product
          </label>
          {toProduct && (fb.ctx ? <ThemeField value={theme} onChange={setTheme} themes={fb.ctx.themes} /> : <p className="text-xs text-muted-foreground">Finding Product&apos;s themes…</p>)}
        </Field>
        <Field label="Follow up">
          <div className="flex flex-wrap gap-1.5">
            <Chips label="Follow up" value={quickLabel as (typeof FOLLOW_UPS)[number]["label"] | ""} options={FOLLOW_UPS.map((f) => f.label)} onChange={(v) => setFollowDate(v ? addDays(today, FOLLOW_UPS.find((f) => f.label === v)!.days) : null)} />
            <DatePicker value={followDate} today={today} onPick={setFollowDate} allowClear={false}>
              <button type="button" className={cn("h-8 rounded-md border px-2.5 text-[13px] whitespace-nowrap hover:bg-muted sm:h-7", followDate && !quickLabel && "border-foreground bg-foreground text-background hover:bg-foreground")}>
                {followDate && !quickLabel ? shortDate(followDate, today) : "Pick a date"}
              </button>
            </DatePicker>
            <button type="button" aria-pressed={!followDate} onClick={() => setFollowDate(null)} className={cn("h-8 rounded-md border px-2.5 text-[13px] whitespace-nowrap hover:bg-muted sm:h-7", !followDate && "border-foreground bg-foreground text-background hover:bg-foreground")}>
              No follow-up
            </button>
          </div>
          {followDate && (
            <div className="flex items-center gap-2">
              <label htmlFor="log-next" className="shrink-0 text-xs text-muted-foreground">
                Next step
              </label>
              <input id="log-next" value={step} onChange={(e) => setNextStep(e.target.value)} className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />
            </div>
          )}
        </Field>

        {!more ? (
          <button type="button" onClick={() => setMore(true)} className="flex h-10 items-center gap-2 rounded-lg bg-muted/60 px-3 text-left text-[13px] hover:bg-muted">
            <span className="flex-1">
              Add what you learned <span className="text-muted-foreground">· {tracksPractice ? "software, cases a month, " : ""}{tracksPitch ? "objection, pitch, " : ""}minutes, stage</span>
            </span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </button>
        ) : (
          <div className="flex flex-col gap-4 rounded-lg bg-muted/40 p-3">
            {tracksPractice && (
              <>
                <Field label="Current software">
                  <Chips label="Current software" value={software} options={SOFTWARE} onChange={setSoftware} allowNone />
                </Field>
                <Field label="Cases a month" htmlFor="log-cases">
                  <input id="log-cases" inputMode="numeric" value={cases} onChange={(e) => setCases(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 40" className="h-8 w-32 rounded-md border bg-background px-2.5 text-sm" />
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
            <div className="flex flex-wrap gap-4">
              <Field label="Minutes" htmlFor="log-min">
                <input id="log-min" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 12" className="h-8 w-24 rounded-md border bg-background px-2.5 text-sm" />
              </Field>
              <Field label="Stage after" htmlFor="log-stage">
                <select id="log-stage" value={stage} onChange={(e) => setStageOverride(Number(e.target.value))} className="h-8 rounded-md border bg-background px-2 text-sm">
                  {STAGES.map((s, i) => (
                    <option key={s} value={i}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        )}
      </div>
      <div className="sticky bottom-0 flex flex-col gap-3 border-t bg-muted/50 px-5 py-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
          {stage === target.stage ? "Stays at " : "Moves to "}
          <strong className="font-medium text-foreground">{STAGES[stage]}</strong>
          {followDate ? (
            <>
              {" "}
              · {step ? `“${step}” ` : "follow up "}on {shortDate(followDate, today)}
            </>
          ) : (
            " · no follow-up"
          )}{" "}
          · saved to the sheet
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onDone} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </>
  );
}
