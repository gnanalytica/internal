"use client";

import { ChevronDown, Link2, Plus, Unlink } from "lucide-react";
import { useMemo, useState } from "react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { countBySourceBucket, groupByTheme, isUnsorted, quoteText, SOURCE_BUCKETS, sourceBucket, type SourceBucketId, type ThemeGroup } from "@/lib/product-roadmap";
import { tone } from "@/lib/tones";
import type { FeatureWithRelations, FeedbackWithRelations } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SourceDot } from "./source-dot";

const QUOTES_SHOWN = 3;

function SourceChips({ counts, value, onChange }: { counts: Record<SourceBucketId, number>; value: SourceBucketId | null; onChange: (v: SourceBucketId | null) => void }) {
  return (
    <div role="group" aria-label="Filter by where it came from" className="flex flex-wrap gap-1.5">
      {SOURCE_BUCKETS.map((b) => {
        const on = value === b.id;
        return (
          <button
            key={b.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? null : b.id)}
            className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors sm:h-7", on ? "border-foreground/40 bg-foreground/5 font-medium text-foreground" : "border-transparent bg-muted text-foreground/80 hover:text-foreground")}
          >
            <span aria-hidden className={cn("size-[7px] rounded-full", tone(b.tone).dot)} />
            {b.label}
            <span className="font-mono text-[11px] tabular-nums opacity-70">{counts[b.id]}</span>
          </button>
        );
      })}
    </div>
  );
}

function LinkPicker({ group, features, onLink, onCreateFeature }: { group: ThemeGroup<FeedbackWithRelations>; features: FeatureWithRelations[]; onLink: (featureId: string | null) => void; onCreateFeature: () => void }) {
  const open = features.filter((f) => f.status !== "archived" && f.status !== "shipped");
  const shipped = features.filter((f) => f.status === "shipped");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted" aria-label={`Link “${group.name}” to a feature`}>
        <Link2 className="size-3.5" />
        {group.featureId ? "Change" : "Link"}
        <ChevronDown className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto max-w-80 min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Link all {group.items.length} to</DropdownMenuLabel>
          {open.length === 0 && shipped.length === 0 && <DropdownMenuItem disabled>No features on the roadmap yet</DropdownMenuItem>}
          {open.map((f) => (
            <DropdownMenuItem key={f.id} onClick={() => onLink(f.id)}>
              <span className="truncate">{f.title}</span>
              {f.id === group.featureId && !group.mixed && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        {shipped.length > 0 && (
          <DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Shipped</DropdownMenuLabel>
            {shipped.map((f) => (
              <DropdownMenuItem key={f.id} onClick={() => onLink(f.id)}>
                <span className="truncate">{f.title}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onCreateFeature}>
          <Plus /> New feature from this theme
        </DropdownMenuItem>
        {group.featureId && (
          <DropdownMenuItem onClick={() => onLink(null)}>
            <Unlink /> Unlink
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeCard({ group, features, onEdit, onLink, onCreateFeature, onOpenFeature }: { group: ThemeGroup<FeedbackWithRelations>; features: FeatureWithRelations[]; onEdit: (item: FeedbackWithRelations) => void; onLink: (featureId: string | null) => void; onCreateFeature: () => void; onOpenFeature: (id: string) => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? group.items : group.items.slice(0, QUOTES_SHOWN);
  const linked = group.featureId ? features.find((f) => f.id === group.featureId) : null;
  return (
    <section aria-label={group.name} className="flex min-w-0 flex-col gap-2.5 rounded-lg border bg-card p-3 shadow-xs">
      <div className="flex items-baseline gap-2">
        <h3 className="min-w-0 flex-1 text-[13px] font-semibold">{group.name}</h3>
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{group.items.length}</span>
      </div>
      <ul className="flex flex-col gap-1">
        {shown.map((f) => (
          <li key={f.id}>
            <button type="button" onClick={() => onEdit(f)} title="Edit" className="-mx-1.5 flex w-[calc(100%+0.75rem)] items-baseline gap-2 rounded-md px-1.5 py-1 text-left text-[13px] leading-relaxed hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none">
              <SourceDot source={f.source} />
              <span className="min-w-0 flex-1">
                <span>“{quoteText(f)}”</span> <span className="text-xs text-muted-foreground">· {f.contact || sourceBucket(f.source).label}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {group.items.length > QUOTES_SHOWN && (
        <button type="button" onClick={() => setAll((a) => !a)} aria-expanded={all} className="self-start text-xs text-muted-foreground hover:text-foreground">
          {all ? "Show fewer" : `Show all ${group.items.length}`}
        </button>
      )}
      {isUnsorted(group.name) ? (
        // Not a theme, so nothing to link: each item wants a theme of its own first.
        <p className="border-t pt-2 text-xs text-muted-foreground">No theme yet. Open one to give it a theme and it moves there.</p>
      ) : (
        <div className="flex items-center gap-2 border-t pt-2">
          <span className="min-w-0 flex-1 text-xs">
            {linked ? (
              <>
                <span className="text-muted-foreground">Linked to: </span>
                <button type="button" onClick={() => onOpenFeature(linked.id)} className={cn("font-medium hover:underline", tone("indigo").text)}>
                  {linked.title}
                </button>
                {group.mixed && <span className="text-muted-foreground"> · not all of them</span>}
              </>
            ) : (
              <span className="text-muted-foreground">Not linked to a feature yet</span>
            )}
          </span>
          <LinkPicker group={group} features={features} onLink={onLink} onCreateFeature={onCreateFeature} />
        </div>
      )}
    </section>
  );
}

/**
 * Feedback read by theme: where it came from (as filter chips with counts),
 * then one card per theme with its quotes and the feature it argues for.
 */
export function FeedbackThemes({
  feedback,
  features,
  onAdd,
  onEdit,
  onLinkTheme,
  onCreateFeatureFromTheme,
  onOpenFeature,
}: {
  feedback: FeedbackWithRelations[];
  features: FeatureWithRelations[];
  onAdd: () => void;
  onEdit: (item: FeedbackWithRelations) => void;
  onLinkTheme: (ids: string[], featureId: string | null) => void;
  onCreateFeatureFromTheme: (name: string, ids: string[]) => void;
  onOpenFeature: (id: string) => void;
}) {
  const [bucket, setBucket] = useState<SourceBucketId | null>(null);
  const counts = useMemo(() => countBySourceBucket(feedback), [feedback]);
  const groups = useMemo(() => groupByTheme(bucket ? feedback.filter((f) => sourceBucket(f.source).id === bucket) : feedback), [feedback, bucket]);
  // Linking acts on the whole theme, including items the source filter hides.
  const idsByTheme = useMemo(() => new Map(groupByTheme(feedback).map((g) => [g.key, g.items.map((i) => i.id)])), [feedback]);
  const themeIds = (g: ThemeGroup<FeedbackWithRelations>) => idsByTheme.get(g.key) ?? g.items.map((i) => i.id);

  if (feedback.length === 0)
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed px-4 py-5 text-[13px] leading-relaxed text-muted-foreground">
        <p>No feedback yet. When a prospect, customer or interviewee tells you something, add it in their words and give it a theme. Items with the same theme are read together here, and a theme can be linked to the feature it argues for.</p>
        <button type="button" onClick={onAdd} className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-[13px] text-foreground hover:bg-muted">
          <Plus className="size-3.5" /> Add the first piece
        </button>
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      <SourceChips counts={counts} value={bucket} onChange={setBucket} />
      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-5 text-[13px] text-muted-foreground">No feedback under “{SOURCE_BUCKETS.find((b) => b.id === bucket)?.label}” yet. Click the chip again to see everything.</p>
      ) : (
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {groups.map((g) => (
            <ThemeCard
              key={g.key}
              group={g}
              features={features}
              onEdit={onEdit}
              onLink={(fid) => onLinkTheme(themeIds(g), fid)}
              onCreateFeature={() => onCreateFeatureFromTheme(g.name, themeIds(g))}
              onOpenFeature={onOpenFeature}
            />
          ))}
        </div>
      )}
    </div>
  );
}
