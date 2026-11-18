"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { saveProspect } from "@/lib/prospects/actions";
import type { ProspectRecord } from "@/lib/prospects/parse";
import { displayDate } from "@/lib/prospects/parse";
import { type ProspectKind } from "@/lib/prospects/schema";
import { cn } from "@/lib/utils";
import { type StageSubject } from "../stage-check";
import type { LogOpts } from "./index";


export type Ctx = { kind: ProspectKind; id: string; today: string; me: string; team: string[]; onChanged: () => void; onLog: (o?: LogOpts) => void; onOpen: (r: { kind: ProspectKind; id: string }) => void };

export function useSave(ctx: Ctx) {
  const [pending, start] = useTransition();
  const save = (patch: Record<string, string | number | null>, after?: () => void) =>
    start(async () => {
      const r = await saveProspect(ctx.kind, ctx.id, patch);
      if (r.ok) {
        toast.success(r.message);
        after?.();
        ctx.onChanged();
      } else toast.error(r.message);
    });
  return { save, pending };
}

export function subjectOf(r: ProspectRecord): StageSubject {
  return { kind: r.kind, id: r.id, name: r.name, stage: r.stage, nextStep: r.nextStep, nextStepDate: r.nextStepDate, cases: r.casesPerMonth, software: r.software, pitchAngle: r.pitchAngle, objections: r.objections, hasPhone: Boolean(r.phone) };
}

/* ---------- building blocks ---------- */

export function Section({ title, aside, children, className }: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex min-h-7 items-center gap-2">
        <h3 className="flex-1 text-sm font-semibold">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** A two-column table of label → value, the shape every facts block on the page uses. */
export function FactTable({ rows }: { rows: { label: string; value: React.ReactNode; missing?: boolean }[] }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-[13px]">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-border/60 last:border-0">
              <th scope="row" className="w-40 bg-muted/30 px-3 py-2 text-left align-top font-normal text-muted-foreground">
                {r.label}
              </th>
              <td className={cn("px-3 py-2 break-words", r.missing && "text-amber-700 dark:text-amber-400")}>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SmallButton({ children, ...props }: React.ComponentProps<"button">) {
  return (
    <button type="button" {...props} className={cn("inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-50", props.className)}>
      {children}
    </button>
  );
}


/* ---------- popups ---------- */

/** A long text cell edited in a dialog: notes, a draft, research notes. */
export function TextDialog(props: { ctx: Ctx; col: string; title: string; description?: string; value: string; initial?: string; open: boolean; onOpenChange: (o: boolean) => void; rows?: number }) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="gap-4 sm:max-w-2xl">{props.open && <TextForm {...props} />}</DialogContent>
    </Dialog>
  );
}

/** Mounted each time the dialog opens, so it starts from the cell's current text. */
export function TextForm({ ctx, col, title, description, value, initial, onOpenChange, rows = 12 }: { ctx: Ctx; col: string; title: string; description?: string; value: string; initial?: string; onOpenChange: (o: boolean) => void; rows?: number }) {
  const [draft, setDraft] = useState(initial ?? value);
  const { save, pending } = useSave(ctx);
  return (
    <>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <textarea aria-label={title} value={draft} onChange={(e) => setDraft(e.target.value)} rows={rows} className="w-full rounded-lg border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={pending || draft.trim() === value.trim()} onClick={() => save({ [col]: draft.trim() }, () => onOpenChange(false))}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
    </>
  );
}

/** Add a dated line to the top of notes, the way logging a touch does. */
export function AddNoteDialog({ ctx, r, open, onOpenChange }: { ctx: Ctx; r: ProspectRecord; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [text, setText] = useState("");
  const { save, pending } = useSave(ctx);
  const line = `${displayDate(ctx.today)} — ${text.trim()} — ${ctx.me.split(/\s+/)[0]}`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a note</DialogTitle>
          <DialogDescription>Goes at the top of {r.name}&apos;s notes, dated and signed.</DialogDescription>
        </DialogHeader>
        <textarea aria-label="Note" autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="e.g. Partner says SBI cases take 3 days to write up." className="w-full rounded-lg border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            disabled={pending || !text.trim()}
            onClick={() =>
              save({ notes: r.notes.trim() ? `${line}\n${r.notes.trim()}` : line }, () => {
                setText("");
                onOpenChange(false);
              })
            }
          >
            {pending ? "Saving…" : "Add note"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
