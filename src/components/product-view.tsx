"use client";

import { MessageSquarePlus } from "lucide-react";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { DepartmentHeader, type DepartmentTab } from "@/components/department-header";
import { FeatureSheet, type FeaturePatch } from "@/components/product/feature-sheet";
import { FeedbackDialog, type FeedbackDialogTarget } from "@/components/product/feedback-dialog";
import { FeedbackThemes } from "@/components/product/feedback-themes";
import { RoadmapBoard } from "@/components/product/roadmap-board";
import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { createFeature, linkFeedbackToFeature, updateFeature } from "@/lib/actions";
import { progressByFeature, themeNames, voicesByFeature, type RoadmapStatus } from "@/lib/product-roadmap";
import type { FeatureWithRelations, FeedbackWithRelations, IssueListItem, TaskContext } from "@/lib/types";

type Tab = "roadmap" | "feedback";
const TAB_IDS: Tab[] = ["roadmap", "feedback"];

const NO_PROGRESS = { done: 0, total: 0, pct: 0 };

/**
 * The Product department: Roadmap (features in Now / Next / Later, each tied
 * to the feedback behind it and the Engineering tickets that build it),
 * and Feedback (what people said, by theme).
 *
 * The roadmap holds features, not tasks. Tickets live on Engineering's board
 * and attach to a feature through `issues.featureId`; feedback through
 * `feedback.featureId`.
 */
export function ProductView({
  heading,
  initialTab,
  scopeProjectId,
  tickets,
  features,
  feedback,
  ctx,
}: {
  heading: string;
  /** The tab to open on, from the URL's ?tab=. */
  initialTab?: string;
  scopeProjectId: string;
  /** Every ticket linked to one of this project's features. */
  tickets: IssueListItem[];
  features: FeatureWithRelations[];
  feedback: FeedbackWithRelations[];
  ctx: TaskContext;
}) {
  const [tab, setTab] = useState<Tab>(() => ((TAB_IDS as string[]).includes(initialTab ?? "") ? (initialTab as Tab) : "roadmap"));
  const [openId, setOpenId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<FeedbackDialogTarget | null>(null);
  const [adding, startAdding] = useTransition();
  const [, start] = useTransition();

  // Moves and edits show at once; the server's answer replaces them when it lands.
  const [shownFeatures, patchFeatureLocal] = useOptimistic(features, (state, p: { id: string; patch: FeaturePatch }) => state.map((f) => (f.id === p.id ? { ...f, ...p.patch } : f)));
  const [shownFeedback, linkLocal] = useOptimistic(feedback, (state, p: { ids: string[]; featureId: string | null }) => state.map((f) => (p.ids.includes(f.id) ? { ...f, featureId: p.featureId } : f)));

  const voices = useMemo(() => voicesByFeature(shownFeedback), [shownFeedback]);
  const progress = useMemo(() => progressByFeature(tickets), [tickets]);
  const themes = useMemo(() => themeNames(shownFeedback), [shownFeedback]);
  const open = shownFeatures.find((f) => f.id === openId) ?? null;

  const patchFeature = (id: string, patch: FeaturePatch, done?: string) =>
    start(async () => {
      patchFeatureLocal({ id, patch });
      try {
        await updateFeature(id, patch);
        if (done) toast.success(done);
      } catch {
        toast.error("Couldn't save that change. Try again.");
      }
    });

  const move = (id: string, status: RoadmapStatus) => patchFeature(id, { status });

  const archive = (id: string) => {
    const f = features.find((x) => x.id === id);
    const was = f?.status ?? "idea";
    setOpenId(null);
    start(async () => {
      patchFeatureLocal({ id, patch: { status: "archived" } });
      try {
        await updateFeature(id, { status: "archived" });
        toast.success(`Archived “${f?.title ?? "feature"}”`, { action: { label: "Undo", onClick: () => patchFeature(id, { status: was }) } });
      } catch {
        toast.error("Couldn't archive that. Try again.");
      }
    });
  };

  const addFeature = (status: RoadmapStatus) =>
    startAdding(async () => {
      try {
        const f = await createFeature({ projectId: scopeProjectId, status });
        setOpenId(f.id);
      } catch {
        toast.error("Couldn't add a feature. Try again.");
      }
    });

  const linkTheme = (ids: string[], featureId: string | null) =>
    start(async () => {
      linkLocal({ ids, featureId });
      try {
        await linkFeedbackToFeature(ids, featureId);
        const title = featureId ? features.find((f) => f.id === featureId)?.title : null;
        toast.success(title ? `Linked ${ids.length} to “${title}”` : "Unlinked");
      } catch {
        toast.error("Couldn't link that. Try again.");
      }
    });

  const featureFromTheme = (name: string, ids: string[]) =>
    startAdding(async () => {
      try {
        const f = await createFeature({ projectId: scopeProjectId, title: name, status: "idea" });
        await linkFeedbackToFeature(ids, f.id);
        toast.success(`Added “${name}” to Later`);
        setOpenId(f.id);
      } catch {
        toast.error("Couldn't add a feature. Try again.");
      }
    });

  const tabs: DepartmentTab<Tab>[] = [
    { id: "roadmap", label: "Roadmap" },
    { id: "feedback", label: "Feedback", count: feedback.length || undefined },
  ];

  return (
    <div className="flex h-full flex-col">
      <Topbar breadcrumb={[{ label: heading }]} />
      <DepartmentHeader
        label="Product views"
        tabs={tabs}
        current={tab}
        onChange={setTab}
        actions={
          <Button size="sm" className="ml-2 shrink-0" onClick={() => setDialog({ mode: "new" })}>
            <MessageSquarePlus /> <span className="max-sm:sr-only">Add feedback</span>
          </Button>
        }
      />

      <div role="tabpanel" aria-label={tab === "roadmap" ? "Roadmap" : "Feedback"} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-3 px-3 py-4 sm:px-5">
          {tab === "roadmap" ? (
            <>
              <p className="text-[13px] text-muted-foreground">Features, not tasks. Each one links to the feedback behind it and the Engineering tickets that build it.</p>
              <RoadmapBoard features={shownFeatures} voices={voices} progress={progress} onOpen={setOpenId} onMove={move} onAdd={addFeature} adding={adding} />
            </>
          ) : (
            <>
              <p className="text-[13px] text-muted-foreground">What people said, grouped by theme. Link a theme to the feature it argues for and it counts as a voice on the roadmap.</p>
              <FeedbackThemes
                feedback={shownFeedback}
                features={shownFeatures}
                onAdd={() => setDialog({ mode: "new" })}
                onEdit={(item) => setDialog({ mode: "edit", item })}
                onLinkTheme={linkTheme}
                onCreateFeatureFromTheme={featureFromTheme}
                onOpenFeature={setOpenId}
              />
            </>
          )}
        </div>
      </div>

      <FeatureSheet
        feature={open}
        feedback={open ? shownFeedback.filter((f) => f.featureId === open.id) : []}
        tickets={open ? tickets.filter((i) => i.featureId === open.id) : []}
        progress={(open && progress.get(open.id)) || NO_PROGRESS}
        ctx={ctx}
        onOpenChange={(o) => !o && setOpenId(null)}
        onPatch={(id, p) => patchFeature(id, p)}
        onArchive={archive}
        themes={themes}
        features={shownFeatures}
      />
      <FeedbackDialog target={dialog} onOpenChange={(o) => !o && setDialog(null)} projectId={scopeProjectId} themes={themes} features={shownFeatures} />
    </div>
  );
}
