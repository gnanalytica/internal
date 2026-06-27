"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createFeedback, deleteFeedback, updateFeedback } from "@/lib/actions";
import { FEEDBACK_SOURCES, FEEDBACK_STATUSES, optionMeta } from "@/lib/departments";
import type { FeedbackWithRelations } from "@/lib/types";

type FeatureRef = { id: string; title: string };

export function FeedbackView({
  scopeProjectId,
  initialFeedback,
  features,
  showProject = false,
}: {
  scopeProjectId: string | null;
  initialFeedback: FeedbackWithRelations[];
  features: FeatureRef[];
  showProject?: boolean;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const refresh = () => router.refresh();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <span className="text-xs text-muted-foreground">
          {initialFeedback.length} items · {initialFeedback.reduce((s, f) => s + f.votes, 0)} votes
        </span>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto h-7 gap-1.5"
          onClick={() => start(async () => { await createFeedback({ projectId: scopeProjectId }); refresh(); })}
        >
          <Plus className="size-4" /> New feedback
        </Button>
      </div>

      <div className="scrollbar-thin flex min-h-0 flex-1 gap-3 overflow-x-auto p-4">
        {FEEDBACK_STATUSES.map((s) => {
          const items = initialFeedback.filter((f) => f.status === s.id);
          return (
            <div key={s.id} className="flex w-72 shrink-0 flex-col">
              <div className="mb-2 flex items-center gap-2 px-1">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-sm font-medium">{s.label}</span>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="flex min-h-24 flex-1 flex-col gap-2 rounded-lg bg-muted/40 p-2">
                {items.map((f) => (
                  <FeedbackCard
                    key={f.id}
                    item={f}
                    features={features}
                    showProject={showProject}
                    onChanged={refresh}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FeedbackCard({
  item,
  features,
  showProject,
  onChanged,
}: {
  item: FeedbackWithRelations;
  features: FeatureRef[];
  showProject: boolean;
  onChanged: () => void;
}) {
  const [, start] = useTransition();
  const upd = (patch: Parameters<typeof updateFeedback>[1]) =>
    start(async () => { await updateFeedback(item.id, patch); onChanged(); });
  const src = optionMeta(FEEDBACK_SOURCES, item.source);

  return (
    <div className="rounded-lg border bg-background p-2.5 shadow-sm">
      <div className="flex items-start gap-1.5">
        <input
          defaultValue={item.title}
          onBlur={(e) => e.target.value !== item.title && upd({ title: e.target.value })}
          className="min-w-0 flex-1 bg-transparent text-sm font-medium focus:outline-none"
        />
        <button
          onClick={() => start(async () => { await deleteFeedback(item.id); onChanged(); })}
          className="text-[11px] text-muted-foreground hover:text-destructive"
        >
          ×
        </button>
      </div>

      <textarea
        defaultValue={item.body ?? ""}
        onBlur={(e) => (e.target.value || null) !== item.body && upd({ body: e.target.value || null })}
        placeholder="Details / context…"
        rows={2}
        className="mt-1 w-full resize-y rounded border bg-background px-1.5 py-1 text-[11px] focus:outline-none"
      />

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <select
          defaultValue={item.source}
          onChange={(e) => upd({ source: e.target.value })}
          className="h-6 rounded border bg-background px-1 text-[11px]"
          style={{ color: src.color }}
          title="Source"
        >
          {FEEDBACK_SOURCES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <select
          defaultValue={item.status}
          onChange={(e) => upd({ status: e.target.value })}
          className="h-6 rounded border bg-background px-1 text-[11px]"
          title="Status"
        >
          {FEEDBACK_STATUSES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <label className="flex items-center gap-1 text-[11px] text-muted-foreground" title="Votes / how many asked">
          ▲
          <input
            type="number"
            defaultValue={item.votes}
            onBlur={(e) => Number(e.target.value) !== item.votes && upd({ votes: Number(e.target.value) || 0 })}
            className="h-6 w-12 rounded border bg-background px-1 text-[11px]"
          />
        </label>
      </div>

      <div className="mt-1.5">
        <select
          defaultValue={item.featureId ?? ""}
          onChange={(e) => upd({ featureId: e.target.value || null })}
          className="h-6 w-full rounded border bg-background px-1 text-[11px] text-muted-foreground"
          title="Link to a roadmap feature"
        >
          <option value="">↳ link to feature…</option>
          {features.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
        </select>
      </div>

      {(showProject && item.project) || item.contact ? (
        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          {showProject && item.project && (
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full" style={{ backgroundColor: item.project.color }} />
              {item.project.name}
            </span>
          )}
          {item.contact && <span className="truncate">· {item.contact}</span>}
        </div>
      ) : null}
    </div>
  );
}
