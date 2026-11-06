"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createFeedback, deleteFeedback, updateFeedback } from "@/lib/actions";
import { matchThemes, quoteText, sourceBucket, themeKey, themeOf, titleFromQuote } from "@/lib/product-roadmap";
import { tone } from "@/lib/tones";
import type { FeatureWithRelations, FeedbackWithRelations } from "@/lib/types";
import { cn } from "@/lib/utils";

/** The stored sources, worded the way the team talks about them. */
const SOURCE_CHOICES = [
  { id: "sales", label: "Prospect" },
  { id: "customer", label: "Customer" },
  { id: "support", label: "Support" },
  { id: "interview", label: "Interview" },
  { id: "internal", label: "Team" },
  { id: "other", label: "Other" },
] as const;

export type FeedbackDialogTarget = { mode: "new"; featureId?: string | null } | { mode: "edit"; item: FeedbackWithRelations };

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="text-xs font-medium text-foreground/80">
            {label}
          </label>
        ) : (
          <span className="text-xs font-medium text-foreground/80">{label}</span>
        )}
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const inputClass = "h-9 w-full min-w-0 rounded-md border bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:h-8";

function FeedbackForm({ target, projectId, themes, features, onDone }: { target: FeedbackDialogTarget; projectId: string; themes: string[]; features: FeatureWithRelations[]; onDone: () => void }) {
  const editing = target.mode === "edit" ? target.item : null;
  const uid = useId();
  const [quote, setQuote] = useState(editing ? quoteText(editing) : "");
  const [who, setWho] = useState(editing?.contact ?? "");
  const [source, setSource] = useState<string>(editing?.source ?? "sales");
  const [theme, setTheme] = useState(editing ? themeOf(editing) : "");
  const [featureId, setFeatureId] = useState(editing ? (editing.featureId ?? "") : target.mode === "new" ? (target.featureId ?? "") : "");
  const [pending, start] = useTransition();

  const suggestions = useMemo(() => matchThemes(themes, theme).filter((t) => themeKey(t) !== themeKey(theme)), [themes, theme]);
  const existing = themes.find((t) => themeKey(t) === themeKey(theme));
  // Archived features can't be picked for new feedback; one already linked stays listed.
  const pickable = features.filter((f) => f.status !== "archived" || f.id === featureId);

  const submit = () => {
    const q = quote.trim();
    if (!q) {
      toast.error("Write down what they said");
      return;
    }
    // An existing theme keeps its first spelling, so "pricing" lands in "Pricing".
    const t = existing ?? (theme.trim() || null);
    start(async () => {
      try {
        if (editing) {
          await updateFeedback(editing.id, { body: q, contact: who.trim() || null, source, theme: t, featureId: featureId || null });
          toast.success("Feedback saved");
        } else {
          await createFeedback({ projectId, title: titleFromQuote(q), body: q, contact: who.trim() || null, source, theme: t, featureId: featureId || null });
          toast.success(t ? `Added to “${t}”` : "Feedback added");
        }
        onDone();
      } catch {
        toast.error("Couldn't save that. Try again.");
      }
    });
  };

  const remove = () => {
    if (!editing) return;
    start(async () => {
      try {
        await deleteFeedback(editing.id);
        toast.success("Feedback deleted");
        onDone();
      } catch {
        toast.error("Couldn't delete that. Try again.");
      }
    });
  };

  return (
    <>
      <DialogHeader className="gap-0.5 px-5 pt-5 pb-1">
        <DialogTitle>{editing ? "Edit feedback" : "Add feedback"}</DialogTitle>
        <DialogDescription>{editing ? "Change the words, who said it, or the theme it belongs to." : "What someone said, in their words. Items with the same theme are read together."}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-5 px-5 pt-3 pb-5">
        <Field label="What they said" htmlFor={`${uid}-q`}>
          <textarea
            id={`${uid}-q`}
            autoFocus
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            rows={3}
            placeholder="e.g. If one number is wrong the bank sends it back to me, not to you."
            className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </Field>
        <Field label="Who" htmlFor={`${uid}-who`}>
          <input id={`${uid}-who`} value={who} onChange={(e) => setWho(e.target.value)} placeholder="e.g. Mr. Sachin Goel, valuer · or Interview, 21 Oct" className={inputClass} />
        </Field>
        <Field label="Where it came from">
          <div role="radiogroup" aria-label="Where it came from" className="flex flex-wrap gap-1.5">
            {SOURCE_CHOICES.map((s) => {
              const on = s.id === source;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setSource(s.id)}
                  className={cn("inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] whitespace-nowrap transition-colors sm:h-7", on ? "border-foreground bg-foreground text-background" : "hover:bg-muted")}
                >
                  <span aria-hidden className={cn("size-[7px] rounded-full", tone(sourceBucket(s.id).tone).dot)} />
                  {s.label}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Theme" htmlFor={`${uid}-theme`} hint={theme.trim() ? (existing ? "existing theme" : "new theme") : "what it's about, in a few words"}>
          <input id={`${uid}-theme`} value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="e.g. Trust in AI extraction" autoComplete="off" aria-describedby={suggestions.length ? `${uid}-themes` : undefined} className={inputClass} />
          {suggestions.length > 0 && (
            <div id={`${uid}-themes`} role="group" aria-label="Existing themes" className="flex flex-wrap gap-1.5">
              {suggestions.map((t) => (
                <button key={t} type="button" onClick={() => setTheme(t)} className="h-7 max-w-full truncate rounded-full bg-muted px-2.5 text-xs text-foreground/80 hover:bg-muted/70 hover:text-foreground">
                  {t}
                </button>
              ))}
            </div>
          )}
        </Field>
        <Field label="Feature" htmlFor={`${uid}-feat`} hint="optional">
          <select id={`${uid}-feat`} value={featureId} onChange={(e) => setFeatureId(e.target.value)} className={inputClass}>
            <option value="">Not linked to a feature yet</option>
            {pickable.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex flex-col gap-2 border-t bg-muted/50 px-5 py-3 sm:flex-row sm:items-center">
        {editing ? (
          <Button variant="ghost" className="text-destructive hover:text-destructive sm:mr-auto" onClick={remove} disabled={pending}>
            Delete
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground sm:mr-auto">Shows on the Feedback tab under its theme.</span>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onDone} disabled={pending}>
            Cancel
          </Button>
          <Button data-submit onClick={submit} disabled={pending}>
            {pending ? "Saving…" : editing ? "Save" : "Add feedback"}
          </Button>
        </div>
      </div>
    </>
  );
}

/** Add a piece of feedback, or edit one; the form resets each time it opens. */
export function FeedbackDialog({
  target,
  onOpenChange,
  projectId,
  themes,
  features,
}: {
  target: FeedbackDialogTarget | null;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  themes: string[];
  features: FeatureWithRelations[];
}) {
  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-lg"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") e.currentTarget.querySelector<HTMLButtonElement>("[data-submit]")?.click();
        }}
      >
        {target && <FeedbackForm key={target.mode === "edit" ? target.item.id : "new"} target={target} projectId={projectId} themes={themes} features={features} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
