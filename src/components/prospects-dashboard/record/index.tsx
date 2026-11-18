"use client";

import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useProductFeedback } from "@/components/product/send-to-product";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActivityEntry, ProspectRecord } from "@/lib/prospects/parse";
import { KIND_LABEL, STAGES, type Channel, type Outcome, type ProspectKind } from "@/lib/prospects/schema";
import type { Related } from "@/lib/prospects/related";
import { type ProspectRow } from "@/lib/prospects/stats";
import { cn } from "@/lib/utils";
import { KindDot, Owner, StageBar, StageDot } from "../bits";
import { ActivityTab } from "./activity";
import { DetailsTab } from "./details";
import { ActionBar, DoNotContactBanner, StageMenu } from "./header";
import { OverviewTab } from "./overview";
import { ResearchTab } from "./research";
import type { Ctx } from "./shared";

export type Selection = { kind: ProspectKind; id: string };
export type Detail = { record: ProspectRecord; activity: ActivityEntry[]; related: { items: Related[]; more: number } };
export type LogOpts = { channel?: Channel; outcome?: Outcome };

/** Past this, the record shows "Couldn't load" with a retry instead of waiting on. The server gives up on Google at 20 s. */
const DETAIL_TIMEOUT_MS = 25_000;

/** One record, its Activity and related rows, or why it couldn't be read. Not found is `null`. */
async function fetchDetail(sel: Selection, signal: AbortSignal): Promise<Detail | null> {
  // No `cache: "no-store"` here: it sends `Cache-Control: no-cache`, which makes Next skip the cached workbook and re-read
  // the whole sheet (~2 s instead of ~0.3 s). The response itself is `no-store`, so the browser never keeps a stale copy.
  const res = await fetch(`/api/prospects/${sel.kind}/${encodeURIComponent(sel.id)}`, { signal });
  if (res.status === 404) return null;
  // Signed out mid-session: the request is redirected to the sign-in page.
  if (res.redirected && new URL(res.url).pathname.startsWith("/auth/")) throw new Error("Your session ended. Reload the page to sign in again.");
  if (!(res.headers.get("content-type") ?? "").includes("application/json")) throw new Error(`The server didn't answer properly (${res.status}).`);
  const body = (await res.json()) as { data?: Detail; error?: string };
  if (!res.ok || !body.data) throw new Error(body.error || `The sheet didn't answer (${res.status}).`);
  return body.data;
}

/**
 * Loads one record for the record page and Today; `reload` after every write.
 * A plain request, not a server action: actions run one at a time, so this
 * used to wait behind related rows and any save in flight. Moving to another
 * prospect cancels the request for the last one.
 */
export function useDetail(sel: Selection | null) {
  const [state, setState] = useState<{ key: string; data: Detail | null; error?: string } | null>(null);
  const [version, setVersion] = useState(0);
  const key = sel ? `${sel.kind}:${sel.id}:${version}` : "";
  useEffect(() => {
    if (!sel) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(new DOMException("timeout", "TimeoutError")), DETAIL_TIMEOUT_MS);
    fetchDetail(sel, ctrl.signal).then(
      (data) => setState({ key, data }),
      (err: unknown) => {
        const timedOut = ctrl.signal.reason instanceof DOMException && ctrl.signal.reason.name === "TimeoutError";
        // Aborted because the person moved on: nothing to show for this one.
        if (ctrl.signal.aborted && !timedOut) return;
        const error = timedOut ? "The sheet took too long to answer." : err instanceof Error ? err.message : "Couldn't load this prospect.";
        // A failed reload keeps the record already on screen.
        setState((prev) => ({ key, data: prev && prev.key.startsWith(`${sel.kind}:${sel.id}:`) ? prev.data : null, error }));
      },
    ).finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const current = state && state.key === key ? state : undefined;
  const sameRecord = Boolean(state && sel && state.key.startsWith(`${sel.kind}:${sel.id}:`));
  // While a reload is in flight, keep showing the last detail for this record so the page does not flash.
  const data = current ? current.data : sameRecord ? state!.data : undefined;
  return { data, error: current?.error ?? null, loading: current === undefined, reload: () => setVersion((v) => v + 1) };
}


/* ---------- page ---------- */

export type RecordTab = "overview" | "activity" | "research" | "details";

/** The full page for one prospect: a header to act from, and tabs for everything known. */
export function RecordPage({
  sel,
  today,
  me,
  team,
  onBack,
  backLabel,
  onLog,
  onChanged,
  detail,
  tab,
  setTab,
  onOpen,
  row,
}: {
  sel: Selection;
  today: string;
  me: string;
  team: string[];
  onOpen: (r: { kind: ProspectKind; id: string }) => void;
  onBack: () => void;
  backLabel: string;
  onLog: (o?: LogOpts) => void;
  onChanged: () => void;
  detail: ReturnType<typeof useDetail>;
  tab: RecordTab;
  setTab: (t: RecordTab) => void;
  /** The list row for this prospect, when the page has it: its header shows at once while the rest loads. */
  row?: ProspectRow;
}) {
  const r = detail.data?.record;
  const ctx: Ctx = { kind: sel.kind, id: sel.id, today, me, team, onChanged, onLog, onOpen };
  // Read again when a touch is added: logging one can send it to Product too.
  const fb = useProductFeedback({ version: detail.data?.activity.length ?? 0 });
  if (!r || !detail.data) {
    return (
      <div className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" className="-ml-2 self-start text-muted-foreground" onClick={onBack}>
          <ArrowLeft /> {backLabel}
        </Button>
        {row && (
          // Read-only: the stage menu and actions need the full record, so they wait for it.
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted-foreground">
                  <KindDot kind={sel.kind} />
                  {KIND_LABEL[sel.kind].one}
                  {row.city ? ` · ${row.city}` : row.state ? ` · ${row.state}` : ""} · <span className="font-mono text-xs">{row.id}</span>
                </p>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{row.name}</h1>
              </div>
              <div className="flex items-center gap-2 text-[13px]">
                {row.assigned && (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Owner name={row.assigned} /> {row.assigned}
                  </span>
                )}
                <span className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5">
                  <StageDot stage={row.stage} />
                  {STAGES[row.stage]}
                </span>
              </div>
            </div>
            <StageBar stage={row.stage} labels className="max-sm:[&_span.text-xs]:hidden" />
          </div>
        )}
        {detail.error ? (
          <div role="alert" className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <span className="flex-1">Couldn&apos;t load this prospect. {detail.error}</span>
            <Button variant="outline" size="sm" onClick={detail.reload}>
              Retry
            </Button>
          </div>
        ) : detail.data === null ? (
          <p className="text-sm text-muted-foreground">This prospect is no longer in the sheet.</p>
        ) : (
          <div aria-busy="true" aria-label="Loading the prospect" className="mx-auto flex w-full max-w-6xl flex-col gap-4">
            {!row && (
              <>
                <Skeleton className="h-7 w-64" />
                <Skeleton className="h-4 w-40" />
              </>
            )}
            <div className="grid grid-cols-4 gap-1.5 sm:flex">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8 sm:w-24" />
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          </div>
        )}
      </div>
    );
  }
  const activity = detail.data.activity;
  return (
    <div className={cn("mx-auto flex max-w-6xl flex-col gap-6", detail.loading && "opacity-80")}>
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="-ml-2 self-start text-muted-foreground" onClick={onBack}>
          <ArrowLeft /> {backLabel}
        </Button>
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted-foreground">
              <KindDot kind={sel.kind} />
              {KIND_LABEL[sel.kind].one}
              {r.city ? ` · ${r.city}` : r.state ? ` · ${r.state}` : ""} · <span className="font-mono text-xs">{r.id}</span>
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{r.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            {r.assigned && (
              <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <Owner name={r.assigned} /> {r.assigned}
              </span>
            )}
            <StageMenu ctx={ctx} r={r} />
          </div>
        </div>
        <StageBar stage={r.stage} labels className="max-sm:[&_span.text-xs]:hidden" />
        <DoNotContactBanner r={r} />
        <ActionBar ctx={ctx} r={r} />
      </div>

      <nav role="tablist" aria-label="Prospect" className="no-scrollbar -mx-3 flex gap-1 overflow-x-auto border-b px-3 sm:mx-0 sm:px-0">
        {(
          [
            { id: "overview", label: "Overview" },
            { id: "activity", label: "Activity", count: activity.length },
            { id: "research", label: "Research" },
            { id: "details", label: "Details" },
          ] as { id: RecordTab; label: string; count?: number }[]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === tab}
            onClick={() => setTab(t.id)}
            className={cn("-mb-px h-10 shrink-0 border-b-2 px-3 text-sm whitespace-nowrap", t.id === tab ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {t.label}
            {t.count ? <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">{t.count}</span> : null}
          </button>
        ))}
      </nav>

      <div className="pb-10">
        {tab === "overview" ? <OverviewTab ctx={ctx} r={r} activity={activity} related={detail.data.related} fb={fb} onTab={setTab} /> : tab === "activity" ? <ActivityTab ctx={ctx} r={r} activity={activity} fb={fb} /> : tab === "research" ? <ResearchTab ctx={ctx} r={r} /> : <DetailsTab ctx={ctx} r={r} />}
      </div>
    </div>
  );
}
