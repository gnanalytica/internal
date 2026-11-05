"use client";

import { ArrowLeft, BookOpen, ExternalLink, MoreHorizontal, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { refreshProspects } from "@/lib/prospects/actions";
import type { ActivityEntry } from "@/lib/prospects/parse";
import { PROSPECT_KINDS, STAGES, type ProspectKind } from "@/lib/prospects/schema";
import type { ProspectRow } from "@/lib/prospects/stats";
import { cn } from "@/lib/utils";
import { StageDot } from "./bits";
import { ListView } from "./list";
import { LogTouchDialog, type LogTarget } from "./log-touch-dialog";
import { MyWork } from "./my-work";
import { Overview } from "./overview";
import { Pipeline } from "./pipeline";
import { Playbook } from "./playbook";
import { RecordFull, RecordPanel, useDetail, type LogOpts, type Selection } from "./record";

export type WorkspaceData = {
  rows: Record<ProspectKind, ProspectRow[]>;
  /** Row counts before the focus-state filter. */
  totals: Record<ProspectKind, number>;
  activity: ActivityEntry[];
  today: string;
  readAt: string;
  warnings: string[];
  sheetUrl: string;
  me: string;
  team: string[];
  scope: "focus" | "all";
  /** The product these prospects sell, for the breadcrumb; null when it is not in the workspace. */
  product: { id: string; name: string; color: string } | null;
};

const TABS = [
  { id: "today", label: "Today" },
  { id: "pipeline", label: "Pipeline" },
  { id: "list", label: "Prospects" },
  { id: "insights", label: "Insights" },
] as const;
type Tab = (typeof TABS)[number]["id"] | "playbook";

/** Tab ids from before the redesign, so old links still land somewhere sensible. */
const OLD_TABS: Record<string, Tab> = { mywork: "today", overview: "insights" };

function tabFrom(v: string | null): Tab {
  if (!v) return "today";
  if (OLD_TABS[v]) return OLD_TABS[v];
  return v === "playbook" || TABS.some((t) => t.id === v) ? (v as Tab) : "today";
}

/** "14:05" in India time — deterministic, so server and client render the same text. */
function readTime(iso: string): string {
  const d = new Date(Date.parse(iso) + 5.5 * 3600_000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** Search every prospect by name, ID or city; picking one hands it back. */
function ProspectPicker({ rows, onPick, open, onOpenChange, children, placeholder }: { rows: ProspectRow[]; onPick: (r: ProspectRow) => void; open: boolean; onOpenChange: (o: boolean) => void; children: React.ReactElement; placeholder: string }) {
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows.filter((r) => r.stage > 0 && r.stage < 6).slice(0, 8);
    return rows.filter((r) => `${r.name} ${r.id} ${r.city}`.toLowerCase().includes(s)).slice(0, 8);
  }, [rows, q]);
  const pick = (r: ProspectRow) => {
    onOpenChange(false);
    setQ("");
    onPick(r);
  };
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={children} />
      <PopoverContent align="end" className="w-[min(92vw,380px)] gap-0 p-0">
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            aria-label={placeholder}
            value={q}
            placeholder={placeholder}
            onChange={(e) => {
              setQ(e.target.value);
              setHi(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") setHi((h) => Math.min(h + 1, hits.length - 1));
              if (e.key === "ArrowUp") setHi((h) => Math.max(h - 1, 0));
              if (e.key === "Enter" && hits[hi]) pick(hits[hi]);
            }}
            className="h-10 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <div className="flex max-h-80 flex-col overflow-y-auto p-1">
          {!q.trim() && hits.length > 0 && <span className="px-2 pt-1.5 pb-1 text-xs text-muted-foreground">In progress</span>}
          {hits.map((r, i) => (
            <button key={`${r.kind}:${r.id}`} type="button" onMouseEnter={() => setHi(i)} onClick={() => pick(r)} className={cn("flex h-9 items-center gap-2.5 rounded-md px-2 text-left text-sm", i === hi && "bg-muted")}>
              <StageDot stage={r.stage} />
              <span className="min-w-0 flex-1 truncate">{r.name}</span>
              <span className="truncate text-xs text-muted-foreground">{r.city || STAGES[r.stage]}</span>
            </button>
          ))}
          {hits.length === 0 && <p className="px-2 py-6 text-center text-sm text-muted-foreground">{q.trim() ? "No prospect matches." : "Type a name, registration number or city."}</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Valytica's sales workspace. Everything shown is read from the prospects
 * Google Sheet; everything changed here is written back to it. View state
 * lives in the URL so any view, list or record can be shared as a link.
 */
export function ProspectsWorkspace({ data }: { data: WorkspaceData }) {
  const router = useRouter();
  const params = useSearchParams();
  const get = (k: string) => params.get(k);
  const [tab, setTabState] = useState<Tab>(tabFrom(get("tab")));
  const [kind, setKindState] = useState<ProspectKind | "">((PROSPECT_KINDS as readonly string[]).includes(get("kind") ?? "") ? (get("kind") as ProspectKind) : "");
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
  const [findOpen, setFindOpen] = useState(false);
  const [logPickOpen, setLogPickOpen] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const detail = useDetail(sel);

  // Mirror view state into the URL without a server round trip.
  const sync = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, []);

  // "/" opens the prospect search from anywhere on the page that is not a text field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        setFindOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const setTab = (t: Tab) => {
    setTabState(t);
    setFullState(false);
    sync({ tab: t === "today" ? null : t, full: null });
  };
  const setKind = (k: ProspectKind | "") => {
    setKindState(k);
    sync({ kind: k || null });
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
    setSelState(null);
    setFullState(false);
    sync({ rec: null, full: null });
  };
  const onChanged = () => {
    detail.reload();
    router.refresh();
  };
  const startLog = (t: LogTarget) => {
    setLogTarget(t);
    setLogOpen(true);
  };
  const logRow = (r: ProspectRow, o?: LogOpts) => startLog({ kind: r.kind, id: r.id, name: r.name, stage: r.stage, nextStep: r.nextStep, ...o });
  const logFromRecord = (o?: LogOpts) => {
    const r = detail.data?.record;
    if (r) startLog({ kind: r.kind, id: r.id, name: r.name, stage: r.stage, nextStep: r.nextStep, ...o });
  };
  const setScope = (s: "focus" | "all") => {
    const next = new URLSearchParams(window.location.search);
    if (s === "all") next.set("scope", "all");
    else next.delete("scope");
    router.push(`?${next.toString()}`);
  };
  const refresh = () =>
    startRefresh(async () => {
      await refreshProspects();
      detail.reload();
    });

  const everyone = useMemo(() => PROSPECT_KINDS.flatMap((k) => data.rows[k]), [data.rows]);
  const showFull = Boolean(sel && full);
  const backLabel = tab === "playbook" ? "Playbook" : TABS.find((t) => t.id === tab)!.label;

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b bg-background">
        <div className="flex h-10 items-center gap-1.5 border-b border-border/60 px-3 text-[13px] text-muted-foreground sm:h-11 sm:px-4">
          {data.product ? (
            <>
              <span aria-hidden className="size-2 rounded-full" style={{ background: data.product.color }} />
              <Link href={`/projects/${data.product.id}`} className="hover:text-foreground">
                {data.product.name}
              </Link>
              <span>/</span>
              <Link href={`/projects/${data.product.id}/sales`} className="hover:text-foreground">
                Sales
              </Link>
              <span>/</span>
            </>
          ) : null}
          <span className="text-foreground">Prospects</span>
          <span className="flex-1" />
          <button type="button" onClick={refresh} disabled={refreshing} title="The page re-reads the sheet at most a minute after any change. Click to re-read it now." className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs hover:bg-muted hover:text-foreground">
            {refreshing ? <RefreshCw className="size-3 animate-spin" /> : <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" />}
            <span className="max-sm:hidden">Synced with sheet ·</span> {readTime(data.readAt)}
          </button>
        </div>
        <div className="flex items-center gap-1 pr-2 pl-1 sm:pr-4 sm:pl-2">
          <nav role="tablist" aria-label="Sales views" className="no-scrollbar flex min-w-0 flex-1 gap-0.5 overflow-x-auto">
            {TABS.map((t) => {
              const active = t.id === tab && !showFull;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setTab(t.id);
                    if (sel) close();
                  }}
                  className={cn("-mb-px h-11 shrink-0 border-b-2 px-2.5 text-sm whitespace-nowrap transition-colors", active ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
                >
                  {t.label}
                  {t.id === "list" && <span className="ml-1.5 font-mono text-[11px] text-muted-foreground/70">{everyone.length.toLocaleString("en-IN")}</span>}
                </button>
              );
            })}
          </nav>
          <ProspectPicker rows={everyone} open={findOpen} onOpenChange={setFindOpen} onPick={open} placeholder="Find a prospect">
            <button type="button" aria-label="Find a prospect" className="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border px-2 text-[13px] text-muted-foreground hover:bg-muted sm:px-2.5">
              <Search className="size-3.5" />
              <span className="max-md:hidden">Find a prospect</span>
              <kbd className="font-mono text-[11px] text-muted-foreground/60 max-md:hidden">/</kbd>
            </button>
          </ProspectPicker>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More" className="shrink-0" />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-48">
              <DropdownMenuItem onClick={() => setTab("playbook")}>
                <BookOpen /> Playbook
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={refresh}>
                <RefreshCw /> Re-read the sheet
              </DropdownMenuItem>
              <DropdownMenuItem render={<a href={data.sheetUrl} target="_blank" rel="noreferrer" />}>
                <ExternalLink /> Open the sheet
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ProspectPicker rows={everyone} open={logPickOpen} onOpenChange={setLogPickOpen} onPick={(r) => logRow(r)} placeholder="Log a touch for…">
            <Button size="sm" className="h-8 shrink-0 max-sm:px-2.5">
              Log<span className="max-sm:hidden">&nbsp;a touch</span>
            </Button>
          </ProspectPicker>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-6 sm:py-5">
        {data.warnings.length > 0 && (
          <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {data.warnings.slice(0, 4).map((w) => (
              <p key={w}>{w}</p>
            ))}
            {data.warnings.length > 4 && <p>…and {data.warnings.length - 4} more.</p>}
          </div>
        )}
        {showFull && sel ? (
          <RecordFull sel={sel} today={data.today} me={data.me} team={data.team} onBack={back} backLabel={backLabel} onLog={logFromRecord} onChanged={onChanged} detail={detail} />
        ) : tab === "today" ? (
          <MyWork
            rows={everyone}
            today={data.today}
            me={data.me}
            onOpen={open}
            onLog={logRow}
            onChanged={() => router.refresh()}
            onFind={() => {
              setKind("valuer");
              setView("a-new");
              setTab("list");
            }}
          />
        ) : tab === "pipeline" ? (
          <Pipeline
            rows={everyone}
            today={data.today}
            me={data.me}
            team={data.team}
            layout={layout}
            setLayout={setLayout}
            scope={data.scope}
            setScope={setScope}
            onOpen={open}
            onMore={(s, k) => {
              setKind(k);
              setStage(s);
              setView("all");
              setTab("list");
            }}
            onChanged={() => router.refresh()}
          />
        ) : tab === "list" ? (
          <ListView
            kind={kind}
            setKind={setKind}
            rows={everyone}
            today={data.today}
            me={data.me}
            team={data.team}
            view={view}
            setView={setView}
            stage={stage}
            setStage={setStage}
            scope={data.scope}
            setScope={setScope}
            onOpen={open}
            onChanged={() => router.refresh()}
            openKey={sel ? `${sel.kind}:${sel.id}` : null}
          />
        ) : tab === "insights" ? (
          <Overview
            rows={everyone}
            activity={data.activity}
            today={data.today}
            me={data.me}
            team={data.team}
            onGotoPlaybook={(s) => {
              setPb(s);
              setTab("playbook");
            }}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <Button variant="ghost" size="sm" className="-ml-2 self-start text-muted-foreground" onClick={() => setTab("today")}>
              <ArrowLeft /> Back
            </Button>
            <Playbook section={pb} setSection={setPb} />
          </div>
        )}
      </div>

      {sel && !showFull && <RecordPanel sel={sel} today={data.today} me={data.me} team={data.team} onClose={close} onExpand={expand} onLog={logFromRecord} onChanged={onChanged} detail={detail} />}
      <LogTouchDialog target={logTarget} today={data.today} open={logOpen} onOpenChange={setLogOpen} onSaved={onChanged} />
    </div>
  );
}
