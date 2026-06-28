"use client";

import { useEffect, useRef, useState } from "react";
import {
  Banknote,
  Building2,
  Check,
  ChevronRight,
  Clock,
  Landmark,
  Layers,
  Maximize,
  Printer,
  Users,
  Zap,
} from "lucide-react";

import { ColumnChart, Donut, type Slice } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Product Strategy — a single-page infographic slide on a fixed 1600×920 canvas
 * scaled to fit (container, full screen, or a landscape print page).
 * Two variants share one layout:
 *  - "valuation"  → Valytica: property valuation (residential/commercial/industrial)
 *  - "feasibility" → Atlas: project feasibility (DPR / TEV / LIE)
 *
 * Grounding & honesty:
 * - Prices (₹200/report) are real (Valytica's billing).
 * - Market figures are MODELED ESTIMATES, ranges noted, anchored to public data.
 */

export type VisionVariant = "valuation" | "feasibility";

// ============================ config types ============================

type Tile = { label: string; value: string; sub: string; tone?: "brand" | "emerald"; icon?: React.ComponentType<{ className?: string }> };
type Cfg = {
  eyebrow: string;
  title: string;
  problem?: string;
  customer?: string;
  badgeOk: string;
  badgeWarn: string;
  numbers: Tile[];
  segments: Slice[];
  funnel: { l: string; v: number; color: string }[];
  combinedNote?: string;
  buyers: Slice[];
  nabc: { key: string; title: string; subtitle: string; color: string; points: string[]; stats: { v: string; l: string }[] }[];
  // "Where we are" execution band — proof (done/now/next), the honest gaps, and the upside.
  stand: { done: string[]; now: string[]; next: string[]; prove: string[]; upside: string };
  trajectory?: { years: { label: string; value: number }[]; note: string };
  footer: string;
};

const inCr = (v: number) => `₹${v.toLocaleString("en-IN")} cr`;

// ============================ VALYTICA · valuation ============================

const VALUATION: Cfg = {
  eyebrow: "Valytica · CEO Vision · India",
  title: "Valuation reports in minutes — built for India's valuers.",
  problem:
    "India's property valuers are buried in manual work — document extraction, per-bank reformatting, month-end crunch — capping their throughput and income while output stays slow and inconsistent, just as the empanelled pool shrinks.",
  badgeOk: "✓ Problem confirmed",
  badgeWarn: "⚠ Market estimated",
  numbers: [
    { label: "Bank valuations / yr", value: "~5M", sub: "report volume", icon: Layers },
    { label: "Registered valuers", value: "~6,176", sub: "IBBI-registered", icon: Users },
    { label: "Bank-empanelled pool", value: "10k+", sub: "wider supply", icon: Landmark },
    { label: "Fee per valuation", value: "₹2.5–4k", sub: "borrower pays · bank-mandated", tone: "brand", icon: Banknote },
  ],
  segments: [
    { label: "Residential valuation", value: 1300, color: "#6366f1" },
    { label: "Commercial valuation", value: 900, color: "#0ea5e9" },
    { label: "Industrial / plant & machinery", value: 800, color: "#14b8a6" },
  ],
  funnel: [
    { l: "Whole market", v: 3000, color: "#6366f1" },
    { l: "We can reach", v: 800, color: "#8b5cf6" },
  ],
  combinedNote: "₹3,000 cr valuation · ₹7,500 cr with feasibility (Atlas)",
  customer: "We sell to: empanelled valuers & firms · banks = later",
  buyers: [
    { label: "Banks & NBFCs (lending)", value: 2400, color: "#1d4ed8" },
    { label: "Investors / M&A / insurance", value: 400, color: "#10b981" },
    { label: "Government / legal (tax, IBC)", value: 200, color: "#0ea5e9" },
  ],
  stand: {
    done: ["Built & live · 3 asset classes", "Grounded AI · 98.4% · 0 hallucinations", "~90% gross margin · ₹180 / report"],
    now: ["Early users & pilots", "Instrumenting usage & retention"],
    next: ["Switch on subscriptions", "Land bank / enterprise deals"],
    prove: ["Recurring revenue", "Willingness to pay / report", "Retention at scale"],
    upside: "Learns from each valuer → comparable-data moat · Atlas (feasibility) cross-sell · digital-lending tailwind",
  },
  nabc: [
    {
      key: "N", title: "Need", subtitle: "Pain — validated", color: "#6366f1",
      points: ["Manual extraction · per-bank reformatting · month-end crunch", "Inconsistent, hard to audit — real liability risk", "Validated in user interviews + live pilots"],
      stats: [{ v: "6 hrs", l: "manual desk work / report" }, { v: "2–3 days", l: "turnaround today" }],
    },
    {
      key: "A", title: "Approach", subtitle: "Our unique solution", color: "#0ea5e9",
      points: ["AI does extraction · cross-check · drafting → bank-ready report", "Valuer keeps inspection & sign-off · human-in-loop", "India-resident · source-cited · res / com / industrial"],
      stats: [{ v: "98.4%", l: "AI accuracy" }, { v: "2–3 days → same day", l: "turnaround" }],
    },
    {
      key: "B", title: "Benefit", subtitle: "Value to the valuer", color: "#10b981",
      points: ["Desk work: 6 hrs → 1.5 hrs / report", "3–4× the reports — and income — same headcount", "Audit-ready · source-cited → less liability"],
      stats: [{ v: "3–4×", l: "reports & income / valuer" }, { v: "4.5 hrs", l: "saved / report" }],
    },
    {
      key: "C", title: "Competition", subtitle: "Who we're up against", color: "#f59e0b",
      points: ["Status quo: manual + spreadsheets (2–3 days)", "Sigmavalue — closest AI rival", "Banks' in-house AI — emerging threat"],
      stats: [{ v: "same-day", l: "vs 2–3 days (manual)" }, { v: "9× cheaper", l: "₹220 vs ₹2,000 / report" }],
    },
  ],
  trajectory: {
    years: [
      { label: "Year 1", value: 3 },
      { label: "Year 2", value: 10 },
      { label: "Year 3", value: 25 },
    ],
    note: "Modeled 3-yr revenue ramp: SaaS (₹6 cr floor) + value-based pricing + enterprise / co-own deals.",
  },
  footer:
    "Prices are real. Market sizes are modeled estimates we still need to confirm — based on public industry and government data. Valuation and feasibility are two related but separate markets (feasibility lives in Atlas).",
};

// ============================ ATLAS · feasibility ============================

const FEASIBILITY: Cfg = {
  eyebrow: "Atlas · CEO Vision · India",
  title: "Bankable project feasibility — TEV, LIE & DPR, on demand.",
  problem:
    "Advisory and engineering firms producing TEV / LIE / DPR are stuck with slow, manual, weeks-long studies that cap how many projects they can take on — even as government and private capex surge and bankability stays hard to standardise.",
  badgeOk: "✓ Demand confirmed",
  badgeWarn: "⚙ Carve-out from Valytica (planned)",
  numbers: [
    { label: "DPRs / year", value: "100k+", sub: "MSME · govt · private", icon: Layers },
    { label: "TEV / LIE firms", value: "~100s", sub: "fragmented supply", icon: Users },
    { label: "Deal value", value: "₹2–50L", sub: "per engagement", tone: "brand", icon: Banknote },
    { label: "LIE monitoring", value: "recurring", sub: "across the build", tone: "emerald", icon: Clock },
  ],
  segments: [
    { label: "Project reports (DPR)", value: 2500, color: "#8b5cf6" },
    { label: "Techno-economic viability (TEV)", value: 1000, color: "#f59e0b" },
    { label: "Lender's engineer / monitoring (LIE)", value: 1000, color: "#ec4899" },
  ],
  funnel: [
    { l: "Whole market", v: 4500, color: "#8b5cf6" },
    { l: "We can reach", v: 900, color: "#f59e0b" },
  ],
  combinedNote: "₹4,500 cr feasibility · ₹7,500 cr with valuation (Valytica)",
  customer: "We sell to: advisory & engineering firms · banks/govt = later",
  buyers: [
    { label: "Banks & NBFCs", value: 1500, color: "#1d4ed8" },
    { label: "Government & tenders", value: 1500, color: "#0ea5e9" },
    { label: "Private corporates (capex)", value: 1100, color: "#10b981" },
    { label: "Investors / PE", value: 400, color: "#8b5cf6" },
  ],
  stand: {
    done: ["TEV / LIE / DPR engine live in Valytica", "Declarative financial-model engine", "Chaptered, lender-ready reports"],
    now: ["Carving out as standalone Atlas", "Building a named pipeline"],
    next: ["Stand up enterprise sales", "Land first lighthouse client"],
    prove: ["Standalone tenancy & auth", "Quantified live pipeline", "Each lender's format"],
    upside: "Benchmark project data → moat · bank empanelment · govt + private capex surge",
  },
  nabc: [
    {
      key: "N", title: "Need", subtitle: "Pain — confirmed", color: "#6366f1",
      points: ["TEV / LIE / DPR are slow, manual, consultant-bound", "Weeks of turnaround · uneven quality", "Demand across banks, govt, private, investors"],
      stats: [{ v: "100k+", l: "DPRs / yr" }, { v: "₹2–50L", l: "per engagement" }],
    },
    {
      key: "A", title: "Approach", subtitle: "Our unique solution", color: "#0ea5e9",
      points: ["AI-drafted TEV/LIE/DPR, engineer-reviewed", "Declarative financial-model engine", "Chaptered · lender-ready · source-cited"],
      stats: [{ v: "weeks → days", l: "turnaround" }, { v: "0", l: "made-up facts" }],
    },
    {
      key: "B", title: "Benefit", subtitle: "Value to the firm", color: "#10b981",
      points: ["More engagements with the same team", "Recurring LIE monitoring revenue", "Later: banks get faster, auditable appraisals"],
      stats: [{ v: "₹1–5 cr", l: "from 5–10 deals" }, { v: "recurring", l: "LIE revenue" }],
    },
    {
      key: "C", title: "Competition", subtitle: "Who we're up against", color: "#f59e0b",
      points: ["Resurgent · Sapient · MITCON (manual, weeks)", "Banks' in-house project teams", "Our edge: AI speed, same lender formats"],
      stats: [{ v: "100s", l: "consultancies" }, { v: "AI-first", l: "vs manual" }],
    },
  ],
  trajectory: {
    years: [
      { label: "Year 1", value: 2 },
      { label: "Year 2", value: 8 },
      { label: "Year 3", value: 20 },
    ],
    note: "Modeled 3-yr revenue ramp from enterprise / co-own deals (₹2–50L ACV) plus recurring LIE.",
  },
  footer:
    "Prices/values are indicative; market sizes are modeled estimates to confirm — based on public industry and government data (govt capex, private-capex survey, MSME DPR pricing). Atlas is the planned carve-out of Valytica's feasibility engine.",
};

const CONFIGS: Record<VisionVariant, Cfg> = { valuation: VALUATION, feasibility: FEASIBILITY };

// ============================ shell (scaled slide) ============================

const BASE_W = 1600;
const BASE_H = 1040;

export function MarketVisionDashboard({ variant = "valuation" }: { variant?: VisionVariant }) {
  const cfg = CONFIGS[variant];
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  const [fs, setFs] = useState(false);

  useEffect(() => {
    const measure = () => {
      const d = document as Document & { webkitFullscreenElement?: Element };
      const on = !!(document.fullscreenElement || d.webkitFullscreenElement);
      if (on) setScale(Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H));
      else setScale(Math.max((stageRef.current?.clientWidth ?? BASE_W) / BASE_W, 0.1));
      setFs(on);
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

  const printPage = () => {
    if (typeof document === "undefined") return;
    document.body.classList.add("printing-onepager");
    const done = () => {
      document.body.classList.remove("printing-onepager");
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.print();
  };

  const fullscreen = () => {
    const el = stageRef.current as (HTMLElement & { webkitRequestFullscreen?: () => void }) | null;
    if (!el) return;
    if (el.requestFullscreen) void el.requestFullscreen();
    else el.webkitRequestFullscreen?.();
  };

  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <div className="mb-3 flex items-center justify-end gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={fullscreen}>
          <Maximize className="size-4" /> Full screen
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={printPage}>
          <Printer className="size-4" /> Print / PDF
        </Button>
      </div>

      <div id="onepager-stage" ref={stageRef} className="relative w-full overflow-hidden" style={fs ? undefined : { height: BASE_H * scale }}>
        <div
          id="market-onepager"
          className="overflow-hidden rounded-xl border bg-card text-foreground shadow-sm"
          style={{ width: BASE_W, height: BASE_H, transform: `scale(${scale})`, transformOrigin: fs ? "center center" : "top left" }}
        >
          <Slide cfg={cfg} />
        </div>
      </div>
    </div>
  );
}

// Back-compat alias (older imports).
export const ValyticaMarketDashboard = MarketVisionDashboard;

// ============================ the slide ============================

function Slide({ cfg }: { cfg: Cfg }) {
  return (
    <div className="flex h-full flex-col px-6 py-5">
      <Header cfg={cfg} />
      <div className="mt-2.5 grid flex-1 auto-rows-fr grid-cols-2 gap-2.5">
        <Panel className="col-span-2" title="The market" icon={Building2}>
          <MarketBody cfg={cfg} />
        </Panel>

        <Panel title="NABC — Need · Approach · Benefit · Competition" icon={Check}>
          <NabcBody cfg={cfg} />
        </Panel>
        <Panel title="Where we are · proof &amp; what's left" icon={Zap}>
          <StandBody cfg={cfg} />
        </Panel>
      </div>
      <p className="mt-2 shrink-0 text-[12.5px] leading-snug text-muted-foreground">{cfg.footer}</p>
    </div>
  );
}

function Header({ cfg }: { cfg: Cfg }) {
  return (
    <div className="-mx-6 -mt-5 px-6 py-5 text-white" style={{ background: "linear-gradient(120deg,#0f172a 0%,#1e293b 50%,#4338ca 130%)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[13.5px] font-semibold uppercase tracking-[0.18em] text-indigo-200">{cfg.eyebrow}</div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full border border-emerald-400/50 bg-emerald-400/15 px-2.5 py-0.5 text-[13.5px] font-semibold text-emerald-100">{cfg.badgeOk}</span>
          <span className="rounded-full border border-amber-400/50 bg-amber-400/15 px-2.5 py-0.5 text-[13.5px] font-semibold text-amber-100">{cfg.badgeWarn}</span>
        </div>
      </div>

      <h1 className="mt-2.5 text-[38px] font-bold leading-[1.04] tracking-tight">{cfg.title}</h1>

      {cfg.problem && (
        <p className="mt-3 max-w-[1180px] text-[15.5px] leading-snug text-indigo-50">
          <span className="mr-1.5 rounded bg-white/15 px-1.5 py-0.5 text-[12.5px] font-bold uppercase tracking-wide text-white">
            The problem
          </span>
          {cfg.problem}
        </p>
      )}
    </div>
  );
}

function Panel({ title, icon: Icon, className, children }: { title: string; icon?: React.ComponentType<{ className?: string }>; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex min-h-0 flex-col overflow-hidden rounded-lg border bg-background p-2.5", className)}>
      <h3 className="mb-1.5 flex shrink-0 items-center gap-1 text-[13.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="size-3 text-brand" />}
        {title}
      </h3>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

// ---- bodies ----

function MarketBody({ cfg }: { cfg: Cfg }) {
  const total = cfg.segments.reduce((s, x) => s + x.value, 0);
  const bt = cfg.buyers.reduce((s, x) => s + x.value, 0);
  const whole = cfg.funnel[0].v;
  const reach = cfg.funnel[1].v;
  const reachPct = Math.round((reach / whole) * 100);
  return (
    <div className="flex h-full items-stretch gap-4">
      {/* market by type — stacked bar */}
      <div className="flex w-[290px] shrink-0 flex-col justify-center gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[12.5px] font-semibold uppercase tracking-wide text-muted-foreground">Market by type</span>
          <span className="text-[20px] font-bold leading-none">{inCr(total)}/yr</span>
        </div>
        <div className="flex h-10 w-full overflow-hidden rounded-md">
          {cfg.segments.map((s) => (
            <div key={s.label} style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }} title={`${s.label}: ${inCr(s.value)}`} />
          ))}
        </div>
        <ul className="space-y-1">
          {cfg.segments.map((s) => (
            <li key={s.label} className="flex items-center gap-1.5 text-[13px]">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{s.label}</span>
              <span className="shrink-0 font-bold tabular-nums">{inCr(s.value)}</span>
              <span className="w-7 shrink-0 text-right text-[11.5px] text-muted-foreground">{Math.round((s.value / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>

      {/* reachability donut + 3-yr revenue columns */}
      <div className="flex flex-1 flex-col justify-center gap-3 border-x px-4">
        <div>
          <div className="mb-1.5 text-[12.5px] font-semibold uppercase tracking-wide text-muted-foreground">Reachable market</div>
          <div className="flex items-center gap-3">
            <Donut
              size={96}
              thickness={15}
              data={[
                { label: cfg.funnel[1].l, value: reach, color: cfg.funnel[1].color },
                { label: "Rest of market", value: whole - reach, color: "#cbd5e1" },
              ]}
              center={
                <div className="leading-none">
                  <div className="text-[18px] font-bold tabular-nums">{reachPct}%</div>
                  <div className="mt-0.5 text-[9px] text-muted-foreground">reach</div>
                </div>
              }
            />
            <ul className="min-w-0 flex-1 space-y-1.5 text-[12.5px]">
              <li className="flex items-center gap-1.5">
                <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: cfg.funnel[1].color }} />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{cfg.funnel[1].l}</span>
                <span className="shrink-0 font-bold tabular-nums">{inCr(reach)}</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-2.5 shrink-0 rounded-sm bg-slate-300" />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{cfg.funnel[0].l}</span>
                <span className="shrink-0 font-bold tabular-nums">{inCr(whole)}</span>
              </li>
            </ul>
          </div>
        </div>
        {cfg.trajectory && (
          <div>
            <div className="mb-0.5 flex items-baseline justify-between text-[12.5px]">
              <span className="font-medium text-muted-foreground">3-yr revenue ramp</span>
              <span className="font-bold">{inCr(cfg.trajectory.years[cfg.trajectory.years.length - 1].value)} by Y3</span>
            </div>
            <ColumnChart
              data={cfg.trajectory.years.map((y, i) => ({
                label: y.label.replace("Year ", "Y"),
                value: y.value,
                color: ["#6ee7b7", "#34d399", "#10b981"][i] ?? "#10b981",
              }))}
              height={96}
              format={(n) => `₹${n}cr`}
            />
          </div>
        )}
      </div>

      {/* stats + who pays / who we sell to */}
      <div className="flex w-[440px] shrink-0 flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          {cfg.numbers.map((t) => (
            <div
              key={t.label}
              className={cn(
                "flex flex-col justify-center rounded-md border px-2 py-1",
                t.tone === "brand" && "border-brand/40 bg-brand/[0.06]",
                t.tone === "emerald" && "border-emerald-500/40 bg-emerald-500/[0.06]",
              )}
            >
              {t.icon && <t.icon className="mb-0.5 size-3.5 text-brand" />}
              <div className="text-[20px] font-bold leading-none tabular-nums">{t.value}</div>
              <div className="mt-0.5 text-[12px] font-medium leading-tight">{t.label}</div>
              <div className="text-[11px] leading-tight text-muted-foreground">{t.sub}</div>
            </div>
          ))}
        </div>
        <div className="text-[12px] leading-snug text-muted-foreground">
          <span className="font-semibold text-foreground">Commissioned by: </span>
          {cfg.buyers.map((b) => `${b.label.split(" ")[0]} ${Math.round((b.value / bt) * 100)}%`).join(" · ")}
        </div>
        {cfg.customer && (
          <div className="rounded bg-brand/10 px-1.5 py-0.5 text-[12px] font-semibold text-brand">{cfg.customer}</div>
        )}
        {cfg.combinedNote && <div className="text-[12px] text-muted-foreground">{cfg.combinedNote}</div>}
      </div>
    </div>
  );
}

function NabcBody({ cfg }: { cfg: Cfg }) {
  // Process flow: Need → Approach → Benefit → Competition, connected by arrows.
  return (
    <div className="flex h-full items-stretch">
      {cfg.nabc.map((n, i) => (
        <div key={n.key} className="flex min-w-0 flex-1 items-stretch">
          <div
            className="flex min-w-0 flex-1 flex-col rounded-md border p-2"
            style={{ borderColor: `${n.color}44`, background: `${n.color}0a` }}
          >
            {/* stage header */}
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="grid size-7 shrink-0 place-items-center rounded-full text-[14.5px] font-bold text-white" style={{ backgroundColor: n.color }}>{n.key}</span>
              <div className="min-w-0">
                <div className="truncate text-[14px] font-bold leading-none" style={{ color: n.color }}>{n.title}</div>
                <div className="mt-0.5 truncate text-[10.5px] leading-tight text-muted-foreground">{n.subtitle}</div>
              </div>
            </div>
            {/* points — absorb the slack so every metric block lands at the same height */}
            <ul className="mt-2 min-h-0 flex-1 space-y-1.5">
              {n.points.map((p) => (
                <li key={p} className="flex items-start gap-1 text-[11.5px] leading-snug text-foreground/90">
                  <span className="mt-1 size-1 shrink-0 rounded-full" style={{ backgroundColor: n.color }} />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            {/* hero metric — fixed height + bottom-aligned so all four squares are uniform */}
            <div
              className="mt-2 flex h-44 shrink-0 flex-col justify-center rounded-md px-2 py-2 text-center"
              style={{ background: `${n.color}16`, border: `1px solid ${n.color}26` }}
            >
              <div className="text-[22px] font-extrabold leading-[1.05]" style={{ color: n.color }}>{n.stats[0].v}</div>
              <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{n.stats[0].l}</div>
              {n.stats[1] && (
                <div className="mt-2 border-t pt-2" style={{ borderColor: `${n.color}26` }}>
                  <div className="text-[15px] font-bold leading-none" style={{ color: n.color }}>{n.stats[1].v}</div>
                  <div className="mt-0.5 text-[10.5px] leading-tight text-muted-foreground">{n.stats[1].l}</div>
                </div>
              )}
            </div>
          </div>
          {/* arrow connector */}
          {i < cfg.nabc.length - 1 && (
            <div className="flex w-4 shrink-0 items-center justify-center">
              <ChevronRight className="size-4 text-muted-foreground/40" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function StandBody({ cfg }: { cfg: Cfg }) {
  // Execution band: proof (done / now / next) as three columns, then the honest
  // gaps ("still to prove") and the single-line upside. Replaces the old SWOT grid.
  const cols = [
    { key: "done", label: "Done", mark: "✓", color: "#10b981", items: cfg.stand.done },
    { key: "now", label: "Now", mark: "●", color: "#f59e0b", items: cfg.stand.now },
    { key: "next", label: "Next", mark: "○", color: "#94a3b8", items: cfg.stand.next },
  ];
  return (
    <div className="flex h-full flex-col gap-2">
      {/* proof columns */}
      <div className="grid min-h-0 flex-1 grid-cols-3 gap-2">
        {cols.map((c) => (
          <div key={c.key} className="flex min-h-0 flex-col rounded-md border p-2" style={{ borderColor: `${c.color}40`, background: `${c.color}0c` }}>
            <div className="mb-1.5 flex shrink-0 items-center gap-1.5">
              <span className="grid size-5 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white" style={{ backgroundColor: c.color }}>{c.mark}</span>
              <span className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: c.color }}>{c.label}</span>
            </div>
            <ul className="min-h-0 flex-1 space-y-1.5">
              {c.items.map((it) => (
                <li key={it} className="flex items-start gap-1.5 text-[12.5px] leading-snug text-foreground/90">
                  <span className="mt-1 size-1 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {/* the honest gaps */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-rose-500">Still to prove</span>
        {cfg.stand.prove.map((p) => (
          <span key={p} className="rounded-full border border-rose-400/40 bg-rose-400/10 px-2 py-0.5 text-[12px] font-medium text-rose-600 dark:text-rose-300">{p}</span>
        ))}
      </div>
      {/* the upside */}
      <div className="shrink-0 rounded-md border border-brand/30 bg-brand/[0.06] px-2.5 py-1.5 text-[12.5px] leading-snug">
        <span className="font-semibold text-brand">Upside · </span>
        <span className="text-foreground/80">{cfg.stand.upside}</span>
      </div>
    </div>
  );
}
