"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { logTouch } from "@/lib/prospects/actions";
import { displayDate } from "@/lib/prospects/parse";
import { CHANNELS, OBJECTIONS, OUTCOMES, PITCH_ANGLES, STAGES, type Channel, type Outcome, type ProspectKind } from "@/lib/prospects/schema";
import { addDays } from "@/lib/prospects/stats";
import { cn } from "@/lib/utils";

export type LogTarget = { kind: ProspectKind; id: string; name: string; stage: number; nextStep: string };

const FOLLOW_UPS = [
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "Next week", days: 7 },
  { label: "In 2 weeks", days: 14 },
  { label: "No follow-up", days: null },
] as const;

const SOFTWARE = ["Word + Excel", "Word templates", "Own software", "Bank's portal", "Another tool"];

/** Where an outcome usually leaves a record — a default the caller can change. */
export function defaultStage(stage: number, channel: Channel, outcome: Outcome): number {
  if (outcome === "Not interested") return 6;
  if (outcome === "Demo booked" || outcome === "Meeting held") return Math.max(stage, 2);
  if (outcome === "Connected" && (channel === "Call" || channel === "Meeting")) return Math.max(stage, 2);
  return Math.max(stage, 1);
}

function defaultNextStep(outcome: Outcome, current: string): string {
  if (outcome === "Demo booked") return "Run the demo";
  if (outcome === "No answer" || outcome === "Busy — call back") return "Try again on another channel";
  if (outcome === "Sent") return "Follow up if no reply";
  if (outcome === "Not interested") return "";
  return current || "Follow up";
}

function Chips<T extends string>({ label, col, value, options, onChange }: { label: string; col: string; value: T | ""; options: readonly T[]; onChange: (v: T | "") => void }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-xs font-semibold">
        {label} <span className="font-mono text-[10px] font-normal text-muted-foreground">→ {col}</span>
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={o === value}
            onClick={() => onChange(o === value ? "" : o)}
            className={cn("h-7 rounded-full border px-2.5 text-xs font-medium", o === value ? "border-foreground bg-foreground text-background" : "hover:bg-muted")}
          >
            {o}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Log a call, message or meeting. Each field names the sheet column it
 * writes, and the footer lists every cell that will change before saving.
 */
export function LogTouchDialog({ target, today, open, onOpenChange, onSaved }: { target: LogTarget | null; today: string; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  if (!target) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {/* Keyed so each record starts from a clean form. */}
        <LogForm key={`${target.kind}:${target.id}`} target={target} today={today} onDone={() => onOpenChange(false)} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}

function LogForm({ target, today, onDone, onSaved }: { target: LogTarget; today: string; onDone: () => void; onSaved: () => void }) {
  const [channel, setChannel] = useState<Channel>("Call");
  const [outcome, setOutcome] = useState<Outcome>("Connected");
  const [stageOverride, setStageOverride] = useState<number | null>(null);
  const [minutes, setMinutes] = useState("");
  const [summary, setSummary] = useState("");
  const [software, setSoftware] = useState("");
  const [cases, setCases] = useState("");
  const [objection, setObjection] = useState("");
  const [pitch, setPitch] = useState("");
  const [follow, setFollow] = useState<string>("In 3 days");
  const [nextStep, setNextStep] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const stage = stageOverride ?? defaultStage(target.stage, channel, outcome);
  const days = FOLLOW_UPS.find((f) => f.label === follow)?.days ?? null;
  const nextDate = days === null ? null : addDays(today, days);
  const step = nextStep ?? defaultNextStep(outcome, target.nextStep);
  const isFirmOrValuer = target.kind !== "rvo";

  const writes = useMemo(() => {
    const cols = ["status", "last_contacted", "notes"];
    if (nextDate) cols.push("next_step_date");
    if (step) cols.push("next_step");
    if (target.kind === "valuer" && software) cols.push("current_software");
    if (target.kind === "valuer" && cases) cols.push("lb_cases_per_month");
    if (isFirmOrValuer && objection) cols.push("objections");
    if (isFirmOrValuer && pitch) cols.push("pitch_angle");
    return cols;
  }, [nextDate, step, software, cases, objection, pitch, target.kind, isFirmOrValuer]);

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
        nextStepDate: nextDate,
        fields: {
          ...(target.kind === "valuer" && software ? { current_software: software } : {}),
          ...(target.kind === "valuer" && cases ? { lb_cases_per_month: Number(cases) } : {}),
          ...(isFirmOrValuer && objection ? { objections: objection } : {}),
          ...(isFirmOrValuer && pitch ? { pitch_angle: pitch } : {}),
        },
      });
      if (res.ok) {
        toast.success(res.message);
        onSaved();
        onDone();
      } else toast.error(res.message);
    });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Log a call or message</DialogTitle>
        <DialogDescription>
          {target.name} · {displayDate(today)}
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <Chips label="Channel" col="Activity.channel" value={channel} options={CHANNELS} onChange={(v) => v && setChannel(v)} />
        <Chips label="Outcome" col="Activity.outcome" value={outcome} options={OUTCOMES} onChange={(v) => v && setOutcome(v)} />
        <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="log-min" className="text-xs font-semibold">
              Minutes <span className="font-mono text-[10px] font-normal text-muted-foreground">→ duration_min</span>
            </label>
            <input id="log-min" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 12" className="h-9 rounded-md border bg-background px-2.5 text-sm" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="log-sum" className="text-xs font-semibold">
              What they said <span className="font-mono text-[10px] font-normal text-muted-foreground">→ notes + Activity.summary</span>
            </label>
            <input id="log-sum" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="e.g. 4 banks, SBI format is the slowest. Wants to see it on a live case." className="h-9 rounded-md border bg-background px-2.5 text-sm" />
          </div>
        </div>
        {target.kind === "valuer" && (
          <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
            <Chips label="Current software" col="current_software" value={software} options={SOFTWARE} onChange={setSoftware} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="log-cases" className="text-xs font-semibold">
                Cases / month <span className="font-mono text-[10px] font-normal text-muted-foreground">→ lb_cases_per_month</span>
              </label>
              <input id="log-cases" inputMode="numeric" value={cases} onChange={(e) => setCases(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 40" className="h-9 rounded-md border bg-background px-2.5 text-sm" />
            </div>
          </div>
        )}
        {isFirmOrValuer && <Chips label="Main objection" col="objections" value={objection} options={OBJECTIONS} onChange={setObjection} />}
        {isFirmOrValuer && <Chips label="Pitch that landed" col="pitch_angle" value={pitch} options={PITCH_ANGLES} onChange={setPitch} />}
        <Chips label="Next follow-up" col="next_step_date" value={follow} options={FOLLOW_UPS.map((f) => f.label)} onChange={(v) => setFollow(v || "No follow-up")} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="log-next" className="text-xs font-semibold">
              Next step <span className="font-mono text-[10px] font-normal text-muted-foreground">→ next_step</span>
            </label>
            <input id="log-next" value={step} onChange={(e) => setNextStep(e.target.value)} className="h-9 rounded-md border bg-background px-2.5 text-sm" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="log-stage" className="text-xs font-semibold">
              Status after <span className="font-mono text-[10px] font-normal text-muted-foreground">→ status</span>
            </label>
            <select id="log-stage" value={stage} onChange={(e) => setStageOverride(Number(e.target.value))} className="h-9 rounded-md border bg-background px-2 text-sm">
              {STAGES.map((s, i) => (
                <option key={s} value={i}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <DialogFooter className="flex-col items-stretch gap-2 sm:flex-col">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Will write to the sheet:</strong> <span className="font-mono">{writes.join(", ")}</span>
          {nextDate ? ` · follow-up ${displayDate(nextDate)}` : ""} · plus one row in Activity
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onDone} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Save & sync"}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}
