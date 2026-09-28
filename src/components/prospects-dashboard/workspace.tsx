"use client";

import { ExternalLink, RefreshCw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { refreshProspects } from "@/lib/prospects/actions";
import type { ActivityEntry } from "@/lib/prospects/parse";
import { KIND_LABEL, PROSPECT_KINDS, type ProspectKind } from "@/lib/prospects/schema";
import type { ProspectRow } from "@/lib/prospects/stats";
import { cn } from "@/lib/utils";
import { Segmented } from "./bits";
import { ListView } from "./list";
import { LogTouchDialog, type LogTarget } from "./log-touch-dialog";
import { MyWork } from "./my-work";
import { Overview } from "./overview";
import { Pipeline } from "./pipeline";
import { Playbook } from "./playbook";
import { RecordFull, RecordPanel, useDetail, type Selection } from "./record";

export type WorkspaceData = {
  rows: Record<ProspectKind, ProspectRow[]>;
  /** Row counts before the focus-state filter, for the switch labels. */
  totals: Record<ProspectKind, number>;
  activity: ActivityEntry[];
  today: string;
  readAt: string;
  warnings: string[];
  sheetUrl: string;
  me: string;
  team: string[];
  scope: "focus" | "all";
};

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "mywork", label: "My work" },
  { id: "pipeline", label: "Pipeline" },
  { id: "list", label: "List" },
  { id: "playbook", label: "Playbook" },
] as const;
type Tab = (typeof TABS)[number]["id"];

/** "14:05" in India time — deterministic, so server and client render the same text. */
function readTime(iso: string): string {
  const d = new Date(Date.parse(iso) + 5.5 * 3600_000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/**
 * The Prospects workspace. Everything shown is read from the prospects Google
 * Sheet; everything changed here is written back to it. View state lives in
 * the URL so any view, list or record can be shared as a link.
 */
export function ProspectsWorkspace({ data }: { data: WorkspaceData }) {
  const router = useRouter();
  const params = useSearchParams();
  const get = (k: string) => params.get(k);
  const [tab, setTabState] = useState<Tab>((TABS.find((t) => t.id === get("tab"))?.id ?? "overview") as Tab);
  const [kind, setKindState] = useState<ProspectKind>((PROSPECT_KINDS as readonly string[]).includes(get("kind") ?? "") ? (get("kind") as ProspectKind) : "valuer");
  const [view, setViewState] = useState(get("view") ?? "all");
  const [stage, setStageState] = useState<number | null>(get("stage") ? Number(get("stage")) : null);
  const [layout, setLayoutState] = useState<"board" | "timeline">(get("layout") === "timeline" ? "timeline" : "board");
  const [pb, setPbState] = useState(get("pb") ?? "anchor");
  const [sel, setSelState] = useState<Selection | null>(() => {
    const rec = get("rec");
    const i = rec?.indexOf(":") ?? -1;
    return rec && i > 0 && (PROSPECT_KINDS as readonly string[]).includes(rec.slice(0, i)) ? { kind: rec.slice(0, i) as ProspectKind, id: rec.slice(i + 1) } : null;
  });
  const [full, setFullState] = useState(get("full") === "1");
  const [logTarget, setLogTarget] = useState<LogTarget | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const detail = useDetail(sel);

  // Mirror view state into the URL without a server round trip.
  const sync = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    },
    [],
  );

  const setTab = (t: Tab) => {
    setTabState(t);
    setFullState(false);
    sync({ tab: t === "overview" ? null : t, full: null });
  };
  const setKind = (k: ProspectKind) => {
    setKindState(k);
    setSelState(null);
    setFullState(false);
    sync({ kind: k === "valuer" ? null : k, rec: null, full: null });
  };
  const setView = (v: string) => {
    setViewState(v);
    sync({ view: v === "all" ? null : v });
  };
  const setStage = (s: number | null) => {
    setStageState(s);
    sync({ stage: s === null ? null : String(s) });
  };
  const setLayout = (l: "board" | "timeline") => {
    setLayoutState(l);
    sync({ layout: l === "board" ? null : l });
  };
  const setPb = (s: string) => {
    setPbState(s);
    sync({ pb: s === "anchor" ? null : s });
  };
  const open = (r: { kind: ProspectKind; id: string }) => {
    setSelState({ kind: r.kind, id: r.id });
    setFullState(false);
    sync({ rec: `${r.kind}:${r.id}`, full: null });
  };
  const close = useCallback(() => {
    setSelState(null);
    setFullState(false);
    sync({ rec: null, full: null });
  }, [sync]);
  const expand = () => {
    setFullState(true);
    sync({ full: "1" });
  };
  const back = () => {
    setFullState(false);
    sync({ full: null });
  };
  const onChanged = () => {
    detail.reload();
    router.refresh();
  };
  const startLog = (t: LogTarget) => {
    setLogTarget(t);
    setLogOpen(true);
  };
  const logFromRecord = () => {
    const r = detail.data?.record;
    if (r) startLog({ kind: r.kind, id: r.id, name: r.name, stage: r.stage, nextStep: r.nextStep });
  };
  const setScope = (s: "focus" | "all") => {
    const next = new URLSearchParams(window.location.search);
    if (s === "all") next.set("scope", "all");
    else next.delete("scope");
    router.push(`?${next.toString()}`);
  };

  const rows = data.rows[kind];
  const everyone = useMemo(() => [...data.rows.valuer, ...data.rows.firm, ...data.rows.rvo], [data.rows]);
  const showFull = Boolean(sel && full);

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b bg-background">
        <div className="flex flex-wrap items-center gap-3 px-6 pt-4 pb-2">
          <h1 className="text-xl font-semibold tracking-tight">Prospects</h1>
          <Segmented
            label="Record type"
            value={kind}
            onChange={setKind}
            options={PROSPECT_KINDS.map((k) => ({
              value: k,
              label: (
                <>
                  {KIND_LABEL[k].many} <span className="font-mono text-[11px] text-muted-foreground">{data.rows[k].length.toLocaleString("en-IN")}</span>
                </>
              ),
            }))}
          />
          {kind === "valuer" && (
            <Segmented
              label="States"
              value={data.scope}
              onChange={setScope}
              options={[
                { value: "focus", label: "KA · AP · TS" },
                { value: "all", label: `All India ${data.totals.valuer.toLocaleString("en-IN")}` },
              ]}
            />
          )}
          <span className="flex-1" />
          <span className="text-xs text-muted-foreground" title="The dashboard re-reads the sheet at most a minute after any change; Refresh re-reads it now.">Read from the sheet at {readTime(data.readAt)}</span>
          <Button
            size="sm"
            variant="ghost"
            disabled={refreshing}
            onClick={() =>
              startRefresh(async () => {
                await refreshProspects();
                detail.reload();
              })
            }
          >
            <RefreshCw className={cn(refreshing && "animate-spin")} /> Refresh
          </Button>
          <a href={data.sheetUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
            Open sheet <ExternalLink className="size-3.5" />
          </a>
        </div>
        <nav role="tablist" aria-label="Prospects views" className="flex gap-1 px-5">
          {TABS.map((t) => {
            const active = t.id === tab && !showFull;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={cn("-mb-px border-b-2 px-3 py-2 text-sm transition-colors", active ? "border-brand font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
              >
                {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {data.warnings.length > 0 && (
          <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {data.warnings.slice(0, 4).map((w) => (
              <p key={w}>{w}</p>
            ))}
            {data.warnings.length > 4 && <p>…and {data.warnings.length - 4} more.</p>}
          </div>
        )}
        {showFull && sel ? (
          <RecordFull sel={sel} today={data.today} me={data.me} onBack={back} backLabel={TABS.find((t) => t.id === tab)!.label} onLog={logFromRecord} onChanged={onChanged} detail={detail} />
        ) : tab === "overview" ? (
          <Overview
            kind={kind}
            rows={rows}
            activity={data.activity}
            today={data.today}
            me={data.me}
            team={data.team}
            onOpen={open}
            onGotoList={(v) => {
              setView(v);
              setTab("list");
            }}
            onGotoPlaybook={(s) => {
              setPb(s);
              setTab("playbook");
            }}
          />
        ) : tab === "mywork" ? (
          <MyWork rows={everyone} today={data.today} me={data.me} onOpen={open} onLog={(r) => startLog({ kind: r.kind, id: r.id, name: r.name, stage: r.stage, nextStep: r.nextStep })} onChanged={() => router.refresh()} />
        ) : tab === "pipeline" ? (
          <Pipeline
            rows={rows}
            today={data.today}
            me={data.me}
            team={data.team}
            layout={layout}
            setLayout={setLayout}
            onOpen={open}
            onMore={(s) => {
              setStage(s);
              setView("all");
              setTab("list");
            }}
            onChanged={() => router.refresh()}
          />
        ) : tab === "list" ? (
          <ListView kind={kind} rows={rows} today={data.today} me={data.me} team={data.team} view={view} setView={setView} stage={stage} setStage={setStage} onOpen={open} onChanged={() => router.refresh()} />
        ) : (
          <Playbook section={pb} setSection={setPb} />
        )}
      </div>

      {sel && !showFull && <RecordPanel sel={sel} today={data.today} me={data.me} onClose={close} onExpand={expand} onLog={logFromRecord} onChanged={onChanged} detail={detail} />}
      <LogTouchDialog target={logTarget} today={data.today} open={logOpen} onOpenChange={setLogOpen} onSaved={onChanged} />
    </div>
  );
}
