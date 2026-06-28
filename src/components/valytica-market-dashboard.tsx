"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Building2, Check, Circle, Maximize, Printer, Target, TrendingUp, Zap } from "lucide-react";

import { Donut, type Slice } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Valytica · CEO Vision — a single 16:9 board slide. The whole strategy on one
 * view: north-star vision, why-now, the horizons arc, financial snapshot,
 * market, competition, FDV, SWOT, and pain → desirability → viability.
 *
 * It's a fixed 1280×720 canvas scaled to fit (so type stays crisp at any size):
 * scales to the container normally, to the viewport in Full screen, and to a
 * landscape page in Print/PDF.
 *
 * Grounding & honesty:
 * - Pricing (₹200/report, plans) is grounded in Valytica's billing.ts.
 * - Market figures are MODELED ESTIMATES from a fixed base case (verify #122).
 * - IBBI governs the VALUATION leg only; TEV/LIE/DPR is a separate
 *   bank-empanelled consultant (engineer) market, not IBBI.
 * - Competitors & firm counts are from public sources (see footer).
 */

// ---- model constants ----
const TEV_VOL = 16_000;
const TEV_FEE = 200_000;
const REPORT_SW = 200; // ₹ per property report — grounded
const TEV_SW = 10_000;
const SAM_FRAC = 0.4;
const TIME_SAVED = 0.5;
const BASE = { bankVolM: 4, avgFee: 4000, adoptPct: 6 };

// ---- formatting ----
const cr = (v: number) => v / 1e7;
function fmtCr(v: number): string {
  const c = cr(v);
  return `₹${c.toLocaleString("en-IN", { maximumFractionDigits: c < 100 ? 1 : 0 })} cr`;
}

// ---- model, computed once ----
const bankVol = BASE.bankVolM * 1e6;
const servicesProperty = bankVol * BASE.avgFee;
const servicesTev = TEV_VOL * TEV_FEE;
const servicesTAM = servicesProperty + servicesTev;
const softwareTAM = bankVol * REPORT_SW + TEV_VOL * TEV_SW;
const sam = softwareTAM * SAM_FRAC;
const som = softwareTAM * (BASE.adoptPct / 100);
const valuePerReport = BASE.avgFee * TIME_SAVED;

const BASE_W = 1280;
const BASE_H = 720;

export function ValyticaMarketDashboard() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  const [fs, setFs] = useState(false);

  useEffect(() => {
    const measure = () => {
      const d = document as Document & { webkitFullscreenElement?: Element };
      const fsNow = !!(document.fullscreenElement || d.webkitFullscreenElement);
      if (fsNow) {
        setScale(Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H));
      } else {
        const w = stageRef.current?.clientWidth ?? BASE_W;
        setScale(Math.max(w / BASE_W, 0.1));
      }
      setFs(fsNow);
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro && stageRef.current) ro.observe(stageRef.current);
    window.addEventListener("resize", measure);
    document.addEventListener("fullscreenchange", measure);
    document.addEventListener("webkitfullscreenchange", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
      document.removeEventListener("fullscreenchange", measure);
      document.removeEventListener("webkitfullscreenchange", measure);
    };
  }, []);

  const printPager = () => {
    if (typeof document === "undefined") return;
    document.body.classList.add("printing-onepager");
    const done = () => {
      document.body.classList.remove("printing-onepager");
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.print();
  };

  const fullscreenPager = () => {
    const el = stageRef.current as (HTMLElement & { webkitRequestFullscreen?: () => void }) | null;
    if (!el) return;
    if (el.requestFullscreen) void el.requestFullscreen();
    else el.webkitRequestFullscreen?.();
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-3 flex items-center justify-end gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={fullscreenPager}>
          <Maximize className="size-4" /> Full screen
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={printPager}>
          <Printer className="size-4" /> Print / PDF
        </Button>
      </div>

      <div
        id="onepager-stage"
        ref={stageRef}
        className="relative w-full overflow-hidden"
        style={fs ? undefined : { height: BASE_H * scale }}
      >
        <div
          id="market-onepager"
          className="overflow-hidden rounded-xl border bg-card text-foreground shadow-sm"
          style={{
            width: BASE_W,
            height: BASE_H,
            transform: `scale(${scale})`,
            transformOrigin: fs ? "center center" : "top left",
          }}
        >
          <Slide />
        </div>
      </div>
    </div>
  );
}

// ============================ THE SLIDE ============================

function Slide() {
  return (
    <div className="flex h-full flex-col px-6 py-5">
      <Header />
      <div className="mt-2.5 grid flex-1 grid-rows-[150px_168px_1fr] gap-2.5">
        {/* Row 1 */}
        <div className="grid grid-cols-3 gap-2.5">
          <Panel title="How we grow, step by step" icon={Target}>
            <Horizons />
          </Panel>
          <Panel title="The numbers" icon={TrendingUp}>
            <Financials />
          </Panel>
          <Panel title="Where we stand" icon={Zap}>
            <Swot />
          </Panel>
        </div>
        {/* Row 2 */}
        <div className="grid grid-cols-2 gap-2.5">
          <Panel title="Market opportunity" icon={Building2}>
            <Market />
          </Panel>
          <Panel title="Competitive landscape" icon={Target}>
            <Competition />
          </Panel>
        </div>
        {/* Row 3 — FDV with each lens' evidence in one place */}
        <Panel title="The three big questions · fix the gaps in order" icon={Check}>
          <FdvUnified />
        </Panel>
      </div>
      <p className="mt-2 shrink-0 text-[8.5px] leading-snug text-muted-foreground">
        Prices are real. Market sizes are estimates we still need to confirm. Based on public industry and government
        data plus competitor websites. Valuations and feasibility reports are two related but separate markets.
      </p>
    </div>
  );
}

function Header() {
  const why = [
    { icon: TrendingUp, t: "More loans every year", s: "231M loans a year" },
    { icon: Building2, t: "Too few valuers", s: "~6,176 in India" },
    { icon: Zap, t: "AI is finally good enough", s: "bank-ready reports" },
  ];
  return (
    <div
      className="-mx-6 -mt-5 flex items-center justify-between gap-5 px-6 py-3.5 text-white"
      style={{ background: "linear-gradient(115deg,#0b1f3a 0%,#13315c 52%,#1d4ed8 135%)" }}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-200">
          Valytica · CEO Vision · India
        </div>
        <h1 className="mt-1 text-[30px] font-bold leading-[1.05] tracking-tight">
          Trust infrastructure for India&apos;s secured lending.
        </h1>
        <p className="mt-1 max-w-[640px] text-[12.5px] leading-snug text-blue-100">
          Make every property valuation and feasibility report <span className="font-semibold text-white">fast,
          consistent, and trustworthy</span> — for every bank loan.
        </p>
      </div>
      <div className="flex w-[300px] shrink-0 flex-col gap-1.5">
        <div className="flex items-center justify-end gap-1.5">
          <span className="rounded-full border border-emerald-400/50 bg-emerald-400/15 px-2 py-0.5 text-[9px] font-semibold text-emerald-100">
            ✓ Problem confirmed
          </span>
          <span className="rounded-full border border-amber-400/50 bg-amber-400/15 px-2 py-0.5 text-[9px] font-semibold text-amber-100">
            ⚠ Market estimated
          </span>
        </div>
        {why.map((w) => (
          <div key={w.t} className="flex items-center gap-1.5 rounded border border-white/15 bg-white/[0.06] px-1.5 py-1">
            <w.icon className="size-3 shrink-0 text-blue-200" />
            <span className="text-[9.5px] font-semibold leading-none text-white">{w.t}</span>
            <span className="ml-auto text-[8.5px] leading-none text-blue-200">{w.s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- panels ----

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-background p-2.5">
      <h3 className="mb-1.5 flex shrink-0 items-center gap-1 text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="size-3 text-brand" />}
        {title}
      </h3>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

// ============================ HORIZONS ============================

const HORIZONS: { h: string; title: string; when: string; color: string; proof: string }[] = [
  { h: "1", title: "Win the report", when: "Now", color: "#1d4ed8", proof: "Live now · ₹180 profit per report" },
  { h: "2", title: "Run the whole process", when: "1–2 yrs", color: "#7c3aed", proof: "Turn on subscriptions + first deals" },
  { h: "3", title: "Set the standard", when: "2 yrs+", color: "#10b981", proof: "Data no rival can copy" },
];

function Horizons() {
  return (
    <div className="flex h-full flex-col gap-1.5">
      {HORIZONS.map((z) => (
        <div
          key={z.h}
          className="flex flex-1 items-center gap-2 rounded-md border px-2"
          style={{ borderColor: `${z.color}55`, background: `${z.color}0a` }}
        >
          <span className="text-[12px] font-bold" style={{ color: z.color }}>
            {z.h}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-[12px] font-semibold leading-tight">{z.title}</span>
              <span className="shrink-0 text-[8px] font-medium text-muted-foreground">{z.when}</span>
            </div>
            <div className="truncate text-[9px] leading-tight text-muted-foreground">{z.proof}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================ FINANCIALS ============================

function Financials() {
  const tiles: { label: string; value: string; sub: string; tone?: "brand" | "emerald" }[] = [
    { label: "Total market", value: fmtCr(softwareTAM), sub: "software, per year", tone: "brand" },
    { label: "We can reach", value: fmtCr(sam), sub: "realistically" },
    { label: "3-yr target", value: fmtCr(som), sub: "per year", tone: "emerald" },
    { label: "Bigger services market", value: fmtCr(servicesTAM), sub: "custom builds" },
    { label: "Price per report", value: "₹200", sub: "what banks pay", tone: "brand" },
    { label: "Profit margin", value: "~90%", sub: "₹180 of ₹200", tone: "emerald" },
  ];
  return (
    <div className="grid h-full grid-cols-3 grid-rows-2 gap-1.5">
      {tiles.map((t) => (
        <div
          key={t.label}
          className={cn(
            "flex flex-col justify-center rounded-md border px-1.5",
            t.tone === "brand" && "border-brand/40 bg-brand/[0.06]",
            t.tone === "emerald" && "border-emerald-500/40 bg-emerald-500/[0.06]",
          )}
        >
          <div className="text-[8px] font-medium uppercase tracking-wide text-muted-foreground">{t.label}</div>
          <div className="text-[15px] font-bold leading-none tabular-nums">{t.value}</div>
          <div className="text-[8px] text-muted-foreground">{t.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ============================ FDV ============================

type FdvLens = { key: string; label: string; score: number; color: string; state: string; lever: string; unlocks: string };
const FDV_META: FdvLens[] = [
  { key: "F", label: "Can we build it?", score: 80, color: "#10b981", state: "Yes — it's built", lever: "Move AI to India servers", unlocks: "banks trust us" },
  { key: "D", label: "Do they want it?", score: 64, color: "#f59e0b", state: "Problem confirmed", lever: "Measure real usage", unlocks: "proves they want it" },
  { key: "V", label: "Can we earn?", score: 52, color: "#f59e0b", state: "Two ways to earn", lever: "Launch + win first deals", unlocks: "proves the money" },
];

/** FDV: each lens shows its monetary pointers + a mini chart beneath its gauge,
 * with arrows showing how fixing one lens lifts the next. One place, no repeat. */
function FdvUnified() {
  return (
    <div className="flex h-full items-stretch gap-1.5">
      <FdvCol n={FDV_META[0]}>
        <FeasibilityEvidence />
      </FdvCol>
      <FdvArrow color={FDV_META[1].color} />
      <FdvCol n={FDV_META[1]}>
        <DesirabilityEvidence />
      </FdvCol>
      <FdvArrow color={FDV_META[2].color} />
      <FdvCol n={FDV_META[2]}>
        <ViabilityEvidence />
      </FdvCol>
    </div>
  );
}

function FdvCol({ n, children }: { n: FdvLens; children: React.ReactNode }) {
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col rounded-md border p-2" style={{ borderColor: `${n.color}44`, background: `${n.color}06` }}>
      <div className="mb-1.5 flex items-center gap-2">
        <Gauge score={n.score} color={n.color} />
        <div className="min-w-0">
          <div className="text-[13px] font-bold leading-none" style={{ color: n.color }}>
            {n.label}
          </div>
          <div className="mt-0.5 text-[8.5px] text-muted-foreground">{n.state}</div>
        </div>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
      <div className="mt-1 flex items-center justify-between gap-1.5 text-[8px] font-medium leading-tight" style={{ color: n.color }}>
        <span className="rounded bg-muted/60 px-1.5 py-0.5">⚙ {n.lever}</span>
        <span className="min-w-0 truncate">↗ {n.unlocks}</span>
      </div>
    </div>
  );
}

function FdvArrow({ color }: { color: string }) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center self-center">
      <ArrowRight className="size-4" style={{ color }} />
      <span className="mt-0.5 text-[6.5px] font-semibold uppercase tracking-wide text-muted-foreground">lifts</span>
    </div>
  );
}

// ============================ MARKET ============================

const FIRMS: { k: string; v: string }[] = [
  { k: "6,176", v: "valuers in India" },
  { k: "3,000+", v: "property valuers" },
  { k: "10k+", v: "bank-approved" },
  { k: "100s", v: "feasibility firms" },
];
const DEMAND: { k: string; v: string }[] = [
  { k: "231M", v: "loans a year" },
  { k: "35%", v: "need feasibility checks" },
  { k: "$1.18T", v: "property market by 2033" },
];

function Market() {
  const services: Slice[] = [
    { label: "Valuations", value: Math.round(cr(servicesProperty)), color: "#6366f1" },
    { label: "Feasibility reports", value: Math.round(cr(servicesTev)), color: "#0ea5e9" },
  ];
  const funnel: { l: string; v: number; pct: number; c: string }[] = [
    { l: "All", v: softwareTAM, pct: 100, c: "#6366f1" },
    { l: "Reach", v: sam, pct: SAM_FRAC * 100, c: "#8b5cf6" },
    { l: "Target", v: som, pct: (som / softwareTAM) * 100, c: "#10b981" },
  ];
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="flex-1 space-y-1">
          {funnel.map((f) => (
            <div key={f.l} className="flex items-center gap-1.5">
              <span className="w-10 shrink-0 text-[9px] font-semibold text-muted-foreground">{f.l}</span>
              <div className="h-3.5 flex-1 overflow-hidden rounded bg-muted/60">
                <div className="h-full rounded" style={{ width: `${Math.max(f.pct, 4)}%`, backgroundColor: f.c }} />
              </div>
              <span className="w-12 shrink-0 text-right text-[9.5px] font-bold tabular-nums">{fmtCr(f.v)}</span>
            </div>
          ))}
        </div>
        <Donut
          data={services}
          size={72}
          thickness={11}
          center={
            <div className="text-center">
              <div className="text-[9.5px] font-bold leading-none">{fmtCr(servicesTAM)}</div>
              <div className="text-[7px] text-muted-foreground">services</div>
            </div>
          }
        />
      </div>
      <div className="grid grid-cols-4 gap-1">
        {FIRMS.map((f) => (
          <div key={f.v} className="rounded bg-muted/50 px-1 py-1 text-center">
            <div className="text-[12px] font-bold leading-none text-brand">{f.k}</div>
            <div className="mt-0.5 text-[7.5px] leading-tight text-muted-foreground">{f.v}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {DEMAND.map((d) => (
          <div key={d.v} className="rounded border bg-sky-500/5 px-1 py-1 text-center">
            <div className="text-[11px] font-bold leading-none text-sky-600 dark:text-sky-400">{d.k}</div>
            <div className="mt-0.5 text-[7.5px] leading-tight text-muted-foreground">{d.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================ COMPETITION ============================

const COMP_MAP: { name: string; x: number; y: number; color: string; star?: boolean }[] = [
  { name: "Valytica", x: 84, y: 16, color: "#1d4ed8", star: true },
  { name: "Banks' own AI", x: 74, y: 32, color: "#64748b" },
  { name: "Global tools", x: 90, y: 54, color: "#94a3b8" },
  { name: "Sigmavalue", x: 64, y: 60, color: "#6366f1" },
  { name: "Housing/99acres", x: 72, y: 86, color: "#94a3b8" },
  { name: "Feasibility firms", x: 22, y: 28, color: "#0ea5e9" },
  { name: "Big advisory firms", x: 16, y: 46, color: "#94a3b8" },
];

function Competition() {
  return (
    <div className="flex h-full flex-col gap-1">
      <div className="relative flex-1 rounded-md border bg-muted/20">
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
        <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-border" />
        <div className="absolute right-0 top-0 h-1/2 w-1/2 rounded-tr-md bg-emerald-500/[0.08]" />
        <span className="absolute right-1 top-0.5 text-[7px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
          the open gap
        </span>
        {COMP_MAP.map((c) => (
          <div
            key={c.name}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-0.5"
            style={{ left: `${c.x}%`, top: `${c.y}%` }}
          >
            <span
              className={cn("shrink-0 rounded-full", c.star ? "size-2.5 ring-2 ring-brand/30" : "size-1.5")}
              style={{ backgroundColor: c.color }}
            />
            <span
              className={cn(
                "whitespace-nowrap text-[7.5px] leading-none",
                c.star ? "font-bold text-foreground" : "text-muted-foreground",
              )}
            >
              {c.name}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[7px] text-muted-foreground">
        <span>Done by hand</span>
        <span>Done by AI →</span>
      </div>
      <div className="text-[8px] leading-tight text-muted-foreground">
        The open gap (top-right): <span className="font-semibold text-foreground">AI-powered, bank-ready,
        India-based, and does both jobs</span>. No rival does all four.
      </div>
    </div>
  );
}

// ============================ SWOT ============================

const SWOT: { key: string; title: string; color: string; items: string[] }[] = [
  { key: "S", title: "Strengths", color: "#10b981", items: ["Built and live (both report types)", "High profit per report", "India-based, bank-ready, accurate AI"] },
  { key: "W", title: "Weaknesses", color: "#f43f5e", items: ["Subscriptions not switched on yet", "Not tracking real usage yet", "No sales team yet"] },
  { key: "O", title: "Opportunities", color: "#1d4ed8", items: ["Big open gap in the market", "Large custom deals: ₹20–60 lakh", "Can build data no one else has"] },
  { key: "T", title: "Threats", color: "#f59e0b", items: ["Sigmavalue (closest rival)", "Banks building their own AI", "Will banks trust AI reports?"] },
];

function Swot() {
  return (
    <div className="grid h-full grid-cols-2 grid-rows-2 gap-1">
      {SWOT.map((q) => (
        <div key={q.key} className="flex min-h-0 flex-col overflow-hidden rounded-md border p-1" style={{ borderColor: `${q.color}44` }}>
          <div className="mb-0.5 flex shrink-0 items-center gap-1">
            <span className="grid size-3 place-items-center rounded-sm text-[7px] font-bold text-white" style={{ backgroundColor: q.color }}>
              {q.key}
            </span>
            <h4 className="text-[9px] font-semibold leading-none">{q.title}</h4>
          </div>
          <ul className="min-h-0 flex-1 space-y-px">
            {q.items.map((it) => (
              <li key={it} className="flex items-start gap-1 text-[7.5px] leading-[1.2] text-muted-foreground">
                <span className="mt-1 size-[3px] shrink-0 rounded-full" style={{ backgroundColor: q.color }} />
                <span className="min-w-0">{it}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ============================ FDV evidence — monetary pointers + a mini chart ============================

type Cover = "full" | "partial" | "none";
const COVER_COLOR: Record<Cover, string> = { full: "#10b981", partial: "#f59e0b", none: "#94a3b8" };
const PAIN: Cover[] = ["full", "full", "full", "full", "partial", "none"];

type Stat = "ok" | "next";
const STAT: Record<Stat, { Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string }> = {
  ok: { Icon: Check, color: "#10b981" },
  next: { Icon: Circle, color: "#f59e0b" },
};

/** A status pointer: ✓ have it · ○ still to do, with an optional figure. */
function StatRow({ s, t, v }: { s: Stat; t: string; v?: string }) {
  const { Icon, color } = STAT[s];
  return (
    <li className="flex items-center gap-1 text-[8px] leading-tight">
      <Icon className="size-2.5 shrink-0" style={{ color }} />
      <span className="min-w-0 flex-1 truncate text-muted-foreground">{t}</span>
      {v && (
        <span className="shrink-0 font-bold tabular-nums" style={{ color }}>
          {v}
        </span>
      )}
    </li>
  );
}

function MiniBarRow({ label, right, children }: { label: string; right: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-0.5 flex items-baseline justify-between text-[8px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-bold text-foreground">{right}</span>
      </div>
      {children}
    </div>
  );
}

/** Can we build it? — what's done and the per-report economics. */
function FeasibilityEvidence() {
  return (
    <div className="flex h-full flex-col justify-center gap-1">
      <ul className="space-y-0.5">
        <StatRow s="ok" t="Built and live" />
        <StatRow s="ok" t="Accurate AI — no made-up facts" />
        <StatRow s="ok" t="Profit per report" v="₹180" />
        <StatRow s="ok" t="Sells ₹200 · costs ₹20" />
        <StatRow s="next" t="Move AI to India servers" />
      </ul>
      <MiniBarRow label="Profit margin" right="~90%">
        <div className="h-2 w-full overflow-hidden rounded bg-emerald-500/15">
          <div className="h-full rounded bg-emerald-500" style={{ width: "90%" }} />
        </div>
      </MiniBarRow>
    </div>
  );
}

/** Do they want it? — problem & value are real; demand proof still to come. */
function DesirabilityEvidence() {
  const solved = PAIN.filter((c) => c === "full").length;
  const order: Cover[] = ["full", "partial", "none"];
  const counts = PAIN.reduce((a, c) => ((a[c] += 1), a), { full: 0, partial: 0, none: 0 } as Record<Cover, number>);
  return (
    <div className="flex h-full flex-col justify-center gap-1">
      <ul className="space-y-0.5">
        <StatRow s="ok" t="Real problem, confirmed with users" />
        <StatRow s="ok" t="Saves per report" v={`₹${valuePerReport.toLocaleString("en-IN")}`} />
        <StatRow s="ok" t="Room to raise the price" v="→ ₹400+" />
        <StatRow s="next" t="Prove people keep using it" />
        <StatRow s="next" t="Find out what they'll pay" />
      </ul>
      <MiniBarRow label="Problems we solve" right={`${solved} of ${PAIN.length}`}>
        <div className="flex h-2 w-full overflow-hidden rounded">
          {order.map((c) => (
            <div key={c} style={{ width: `${(counts[c] / PAIN.length) * 100}%`, background: COVER_COLOR[c] }} />
          ))}
        </div>
      </MiniBarRow>
    </div>
  );
}

/** Can we earn? — two ways to make money; revenue not switched on yet. */
function ViabilityEvidence() {
  const ENT_REV = 3e7;
  const saasPct = (som / (som + ENT_REV)) * 100;
  return (
    <div className="flex h-full flex-col justify-center gap-1">
      <ul className="space-y-0.5">
        <StatRow s="ok" t="Two ways to earn money" />
        <StatRow s="ok" t="Subscriptions could reach" v={`${fmtCr(som)}/yr`} />
        <StatRow s="ok" t="Each custom build" v="₹20–60L" />
        <StatRow s="next" t="Switch on subscriptions" />
        <StatRow s="next" t="Win the first big customer" />
      </ul>
      <MiniBarRow label="Where revenue comes from" right="subs · custom">
        <div className="flex h-2 w-full overflow-hidden rounded">
          <div style={{ width: `${saasPct}%`, background: "#1d4ed8" }} />
          <div style={{ width: `${100 - saasPct}%`, background: "#10b981" }} />
        </div>
      </MiniBarRow>
    </div>
  );
}

// ============================ shared ============================

function Gauge({ score, color }: { score: number; color: string }) {
  return (
    <Donut
      size={42}
      thickness={6}
      data={[
        { label: "", value: score, color },
        { label: "", value: Math.max(100 - score, 0.001), color: "transparent" },
      ]}
      center={
        <span className="text-[11px] font-bold" style={{ color }}>
          {score}
        </span>
      }
    />
  );
}
