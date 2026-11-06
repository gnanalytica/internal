"use client";

import { Archive, ExternalLink, MessageSquarePlus, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { StatusIcon } from "@/components/glyphs";
import { NewIssueDialog } from "@/components/new-issue-dialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { STATUS_MAP, type StatusId } from "@/lib/constants";
import { quoteText, ROADMAP_COLUMNS, ticketsLabel, type Progress, type RoadmapStatus } from "@/lib/product-roadmap";
import type { FeatureWithRelations, FeedbackWithRelations, IssueWithRelations, TaskContext } from "@/lib/types";
import { FeedbackDialog, type FeedbackDialogTarget } from "./feedback-dialog";
import { SourceDot } from "./source-dot";
import { TicketBar } from "./roadmap-board";

export type FeaturePatch = Partial<{ title: string; summary: string | null; status: string; ownerId: string | null; targetDate: Date | null }>;

const STATUS_OPTIONS: { id: RoadmapStatus | "archived"; label: string }[] = [
  ...ROADMAP_COLUMNS.map((c) => ({ id: c.id, label: `${c.label} · ${c.hint}` })),
  { id: "shipped", label: "Shipped" },
  { id: "archived", label: "Archived" },
];

/** The Engineering tracks a ticket built for a feature most often starts on. */
const ENGINEERING_DEFAULT_LABEL = "app";

const toDateInput = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-foreground/80">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass = "h-8 w-full min-w-0 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40 [color-scheme:light] dark:[color-scheme:dark]";

function SectionHead({ title, aside }: { title: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <h3 className="flex-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      {aside && <span className="text-xs text-muted-foreground">{aside}</span>}
    </div>
  );
}

/** The editable body; keyed on the feature so its drafts reset when another one opens. */
function FeatureForm({
  feature,
  feedback,
  tickets,
  progress,
  ctx,
  onPatch,
  onArchive,
  themes,
  features,
}: {
  feature: FeatureWithRelations;
  feedback: FeedbackWithRelations[];
  tickets: IssueWithRelations[];
  progress: Progress;
  ctx: TaskContext;
  onPatch: (patch: FeaturePatch) => void;
  onArchive: () => void;
  themes: string[];
  features: FeatureWithRelations[];
}) {
  const [title, setTitle] = useState(feature.title);
  const [summary, setSummary] = useState(feature.summary ?? "");
  const [ticketOpen, setTicketOpen] = useState(false);
  // Opened from inside the sheet so it stacks on top of it rather than closing it.
  const [feedbackFor, setFeedbackFor] = useState<FeedbackDialogTarget | null>(null);
  const engLabel = ctx.labels.find((l) => l.name === ENGINEERING_DEFAULT_LABEL);
  const id = feature.id;

  const saveTitle = () => {
    const t = title.trim();
    if (!t) setTitle(feature.title);
    else if (t !== feature.title) onPatch({ title: t });
  };
  const saveSummary = () => {
    const s = summary.trim() || null;
    if (s !== (feature.summary ?? null)) onPatch({ summary: s });
  };

  return (
    <>
      <SheetHeader className="gap-1 border-b px-5 pt-5 pb-4">
        <SheetTitle className="sr-only">{feature.title}</SheetTitle>
        <SheetDescription className="sr-only">Edit this feature, see the feedback behind it and the tickets that build it.</SheetDescription>
        <label htmlFor={`f-title-${id}`} className="sr-only">
          Title
        </label>
        <input
          id={`f-title-${id}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="mr-8 w-full rounded-md bg-transparent text-lg leading-snug font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <label htmlFor={`f-sum-${id}`} className="sr-only">
          Why this feature, in one line
        </label>
        <textarea
          id={`f-sum-${id}`}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          onBlur={saveSummary}
          rows={2}
          placeholder="Why this feature, in one line. e.g. Valuers will not sign a report they cannot trust."
          className="w-full resize-none rounded-md bg-transparent text-sm leading-relaxed text-muted-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </SheetHeader>

      <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 pb-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Status" htmlFor={`f-status-${id}`}>
            <select id={`f-status-${id}`} value={feature.status} onChange={(e) => onPatch({ status: e.target.value })} className={inputClass}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Owner" htmlFor={`f-owner-${id}`}>
            <select id={`f-owner-${id}`} value={feature.ownerId ?? ""} onChange={(e) => onPatch({ ownerId: e.target.value || null })} className={inputClass}>
              <option value="">Nobody</option>
              {ctx.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Target date" htmlFor={`f-target-${id}`}>
            <input id={`f-target-${id}`} type="date" value={toDateInput(feature.targetDate)} onChange={(e) => onPatch({ targetDate: e.target.value ? new Date(e.target.value) : null })} className={inputClass} />
          </Field>
        </div>

        <section aria-labelledby={`f-fb-${id}`} className="flex flex-col gap-2.5">
          <div id={`f-fb-${id}`}>
            <SectionHead title="The feedback behind it" aside={feedback.length ? `${feedback.length}` : undefined} />
          </div>
          {feedback.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-3 text-xs leading-relaxed text-muted-foreground">No feedback linked yet. Link a theme to this feature from the Feedback tab, or add what someone said.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {feedback.map((f) => (
                <li key={f.id} className="flex items-baseline gap-2 text-[13px] leading-relaxed">
                  <SourceDot source={f.source} />
                  <span className="min-w-0 flex-1">
                    <span>“{quoteText(f)}”</span>
                    {f.contact && <span className="text-xs text-muted-foreground"> · {f.contact}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Button variant="outline" size="sm" className="self-start" onClick={() => setFeedbackFor({ mode: "new", featureId: feature.id })}>
            <MessageSquarePlus /> Add feedback for this
          </Button>
          {feature.projectId && <FeedbackDialog target={feedbackFor} onOpenChange={(o) => !o && setFeedbackFor(null)} projectId={feature.projectId} themes={themes} features={features} />}
        </section>

        <section aria-labelledby={`f-tk-${id}`} className="flex flex-col gap-2.5">
          <div id={`f-tk-${id}`}>
            <SectionHead title="Engineering tickets" aside={ticketsLabel(progress)} />
          </div>
          {tickets.length > 0 && <TicketBar p={progress} />}
          {tickets.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-3 text-xs leading-relaxed text-muted-foreground">No tickets build this yet. Create one here, or set a task&apos;s Feature to this one.</p>
          ) : (
            <ul className="-mx-1.5 flex flex-col">
              {tickets.map((i) => (
                <li key={i.id}>
                  <Link href={`/issues/${i.id}`} className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-[13px] hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none">
                    <StatusIcon status={i.status as StatusId} />
                    <span className="sr-only">{STATUS_MAP[i.status as StatusId]?.label ?? i.status}</span>
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {i.project?.key ? `${i.project.key}-` : "#"}
                      {i.number}
                    </span>
                    <span className={i.status === "done" || i.status === "canceled" ? "min-w-0 flex-1 truncate text-muted-foreground line-through decoration-muted-foreground/40" : "min-w-0 flex-1 truncate"}>{i.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Button variant="outline" size="sm" className="self-start" onClick={() => setTicketOpen(true)}>
            <Plus /> New Engineering ticket
          </Button>
          <NewIssueDialog
            open={ticketOpen}
            onOpenChange={setTicketOpen}
            projects={ctx.projects}
            members={ctx.members}
            labels={ctx.labels}
            defaultProjectId={feature.projectId}
            featureId={feature.id}
            defaultLabelIds={engLabel ? [engLabel.id] : []}
            onCreated={() => setTicketOpen(false)}
          />
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t bg-muted/50 px-5 py-3">
        {feature.projectId && (
          <Link href={`/projects/${feature.projectId}/product/${feature.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground">
            <ExternalLink className="size-3.5" /> Open the spec page
          </Link>
        )}
        <span className="flex-1" />
        {feature.status !== "archived" && (
          <Button variant="ghost" size="sm" onClick={onArchive}>
            <Archive /> Archive
          </Button>
        )}
      </div>
    </>
  );
}

/** The side sheet a roadmap card opens. Saves as you go; nothing to submit. */
export function FeatureSheet({
  feature,
  feedback,
  tickets,
  progress,
  ctx,
  onOpenChange,
  onPatch,
  onArchive,
  themes,
  features,
}: {
  feature: FeatureWithRelations | null;
  feedback: FeedbackWithRelations[];
  tickets: IssueWithRelations[];
  progress: Progress;
  ctx: TaskContext;
  onOpenChange: (open: boolean) => void;
  onPatch: (id: string, patch: FeaturePatch) => void;
  onArchive: (id: string) => void;
  /** For the Add feedback dialog the sheet can open. */
  themes: string[];
  features: FeatureWithRelations[];
}) {
  return (
    <Sheet open={!!feature} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        {feature && (
          <FeatureForm
            key={feature.id}
            feature={feature}
            feedback={feedback}
            tickets={tickets}
            progress={progress}
            ctx={ctx}
            onPatch={(p) => onPatch(feature.id, p)}
            onArchive={() => onArchive(feature.id)}
            themes={themes}
            features={features}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
