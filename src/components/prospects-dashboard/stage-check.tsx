"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { saveProspect } from "@/lib/prospects/actions";
import { OBJECTIONS, PITCH_ANGLES, STAGES, WRITABLE, type ProspectKind } from "@/lib/prospects/schema";
import { todayIST } from "@/lib/prospects/stats";
import { Chips, DatePicker, shortDate } from "./bits";
import { STAGE_COACHING } from "./playbook-content";

/** What a stage move needs to know about the record — a ProspectRow or a full record both fit. */
export type StageSubject = {
  kind: ProspectKind;
  id: string;
  name: string;
  stage: number;
  nextStep: string;
  nextStepDate: string | null;
  cases: number | null;
  software: string;
  pitchAngle: string;
  objections: string;
  hasPhone: boolean;
};

const SOFTWARE = ["Word + Excel", "Word templates", "Own software", "Bank's portal", "Another tool"];

/** The facts the dialog can ask for, and how to tell whether a record already has them. */
const ASKABLE: Record<string, { label: string; has: (s: StageSubject) => boolean }> = {
  lb_cases_per_month: { label: "Cases a month", has: (s) => s.cases !== null },
  current_software: { label: "Current software", has: (s) => Boolean(s.software) },
  objections: { label: "Main objection", has: (s) => Boolean(s.objections) },
  pitch_angle: { label: "Pitch angle", has: (s) => Boolean(s.pitchAngle) },
  next_step: { label: "Next step", has: (s) => Boolean(s.nextStep) },
  next_step_date: { label: "Next step date", has: (s) => Boolean(s.nextStepDate) },
  phone: { label: "Phone", has: (s) => s.hasPhone },
};

/** The fields still empty that the current stage asks for before moving forward. */
export function missingForMove(s: StageSubject, target: number): string[] {
  if (target <= s.stage || target === 6) return [];
  return [...new Set(STAGE_COACHING[s.stage].fields)].filter((f) => ASKABLE[f] && WRITABLE[s.kind].has(f) && !ASKABLE[f].has(s));
}

/**
 * Move a record to another stage. Moving forward with facts missing asks for
 * them first; the person can still move without them.
 */
export function useStageMove(onChanged: () => void) {
  const [ask, setAsk] = useState<{ subject: StageSubject; target: number; fields: string[] } | null>(null);
  const [pending, start] = useTransition();
  const write = (s: StageSubject, target: number, extra: Record<string, string | number | null> = {}) =>
    start(async () => {
      const res = await saveProspect(s.kind, s.id, { ...extra, status: STAGES[target] });
      if (res.ok) {
        toast.success(`${s.name}: ${STAGES[target]}`);
        setAsk(null);
        onChanged();
      } else toast.error(res.message);
    });
  const move = (s: StageSubject, target: number) => {
    if (target === s.stage) return;
    const fields = missingForMove(s, target);
    if (fields.length) setAsk({ subject: s, target, fields });
    else write(s, target);
  };
  const dialog = ask ? <StageCheckDialog key={`${ask.subject.id}:${ask.target}`} ask={ask} pending={pending} onCancel={() => setAsk(null)} onMove={(extra) => write(ask.subject, ask.target, extra)} /> : null;
  return { move, dialog, pending };
}

function StageCheckDialog({ ask, pending, onCancel, onMove }: { ask: { subject: StageSubject; target: number; fields: string[] }; pending: boolean; onCancel: () => void; onMove: (extra: Record<string, string | number | null>) => void }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setVals((p) => ({ ...p, [k]: v }));
  const [today] = useState(() => todayIST());
  const extra = Object.fromEntries(
    Object.entries(vals)
      .filter(([, v]) => v.trim() !== "")
      .map(([k, v]) => [k, k === "lb_cases_per_month" ? Number(v) : v.trim()]),
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="gap-4 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move to {STAGES[ask.target]}</DialogTitle>
          <DialogDescription>
            {ask.subject.name} is missing what {STAGES[ask.subject.stage]} should have found out. Fill what you know.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {ask.fields.map((f) => (
            <div key={f} className="flex flex-col gap-2">
              <span className="text-xs font-medium text-foreground/80">{ASKABLE[f].label}</span>
              {f === "current_software" ? (
                <Chips label={ASKABLE[f].label} value={vals[f] ?? ""} options={SOFTWARE} onChange={(v) => set(f, v)} allowNone />
              ) : f === "objections" ? (
                <Chips label={ASKABLE[f].label} value={vals[f] ?? ""} options={OBJECTIONS} onChange={(v) => set(f, v)} allowNone />
              ) : f === "pitch_angle" ? (
                <Chips label={ASKABLE[f].label} value={vals[f] ?? ""} options={PITCH_ANGLES} onChange={(v) => set(f, v)} allowNone />
              ) : f === "next_step_date" ? (
                <DatePicker value={vals[f] || null} today={today} onPick={(iso) => set(f, iso ?? "")}>
                  <button type="button" className="h-8 self-start rounded-md border px-2.5 text-[13px] hover:bg-muted">
                    {vals[f] ? shortDate(vals[f], today) : "Pick a date"}
                  </button>
                </DatePicker>
              ) : (
                <input
                  aria-label={ASKABLE[f].label}
                  inputMode={f === "lb_cases_per_month" || f === "phone" ? "numeric" : undefined}
                  value={vals[f] ?? ""}
                  onChange={(e) => set(f, f === "lb_cases_per_month" ? e.target.value.replace(/\D/g, "") : e.target.value)}
                  className="h-9 rounded-md border bg-background px-2.5 text-sm"
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="ghost" disabled={pending} onClick={() => onMove({})}>
            Move anyway
          </Button>
          <Button disabled={pending} onClick={() => onMove(extra)}>
            {pending ? "Saving…" : "Save and move"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
