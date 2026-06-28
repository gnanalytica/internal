"use client";

import { useEffect, useRef, useState } from "react";
import {
  Banknote,
  Building2,
  Check,
  Circle,
  Clock,
  Landmark,
  Layers,
  Maximize,
  Printer,
  Receipt,
  Rocket,
  Target,
  TrendingUp,
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
type Stat = "ok" | "next";
type StatRowT = { s: Stat; t: string; v?: string };
type BarT = { label: string; right: string; parts: { pct: number; color: string }[] };
type FdvLens = {
  label: string;
  score: number;
  color: string;
  state: string;
  rows: StatRowT[];
  bar: BarT;
  lever: string;
  unlocks: string;
};
type Cfg = {
  eyebrow: string;
  title: string;
  subtitle: string;
  badgeOk: string;
  badgeWarn: string;
  why: { icon: React.ComponentType<{ className?: string }>; t: string; s: string }[];
  horizons: { n: string; title: string; when: string; color: string; proof: string }[];
  numbers: Tile[];
  segments: Slice[];
  segmentsNote: string;
  funnel: { l: string; v: number; color: string }[];
  buyers: Slice[];
  impact?: {
    deltas: { label: string; before: string; after: string; gain: string }[];
    whyItMatters: string[];
    unlocks: { title: string; detail: string }[];
    note?: string;
  };
  fdv: FdvLens[];
  swot: { key: string; title: string; color: string; items: string[] }[];
  team?: { name: string; role: string; color: string }[];
  teamNote?: string;
  traction?: { label: string; state: "done" | "now" | "next" }[];
  trajectory?: { years: { label: string; value: number }[]; note: string };
  footer: string;
};

const inCr = (v: number) => `₹${v.toLocaleString("en-IN")} cr`;

// ============================ VALYTICA · valuation ============================

const VALUATION: Cfg = {
  eyebrow: "Valytica · CEO Vision · India",
  title: "Trusted property valuation, in minutes — for every bank loan.",
  subtitle:
    "Residential, commercial, and industrial valuations that are fast, consistent, and bank-ready — the product-led wedge.",
  badgeOk: "✓ Problem confirmed",
  badgeWarn: "⚠ Market estimated",
  why: [
    { icon: TrendingUp, t: "More loans every year", s: "231M loans a year in India" },
    { icon: Building2, t: "Too few valuers", s: "~6,176 registered valuers" },
    { icon: Zap, t: "AI is finally good enough", s: "bank-ready reports, fast" },
  ],
  horizons: [
    { n: "1", title: "Win the report", when: "Now", color: "#1d4ed8", proof: "Live now — ₹180 profit per report" },
    { n: "2", title: "Own the workflow", when: "1–2 years", color: "#7c3aed", proof: "Subscriptions + firm accounts" },
    { n: "3", title: "Set the standard", when: "2 years +", color: "#10b981", proof: "Comparable data no rival can copy" },
  ],
  numbers: [
    { label: "Bank valuations / yr", value: "~5M", sub: "report volume", icon: Layers },
    { label: "Registered valuers", value: "~6,176", sub: "IBBI-registered", icon: Users },
    { label: "Bank-empanelled pool", value: "10k+", sub: "wider supply", icon: Landmark },
    { label: "Avg valuation fee", value: "₹2.5–4k", sub: "per report", icon: Banknote },
    { label: "Price per report", value: "₹200", sub: "what banks pay", tone: "brand", icon: Receipt },
    { label: "Gross margin", value: "~90%", sub: "₹180 of ₹200", tone: "emerald", icon: TrendingUp },
  ],
  segments: [
    { label: "Residential valuation", value: 1300, color: "#6366f1" },
    { label: "Commercial valuation", value: 900, color: "#0ea5e9" },
    { label: "Industrial / plant & machinery", value: 800, color: "#14b8a6" },
  ],
  segmentsNote:
    "Modeled estimate of property-valuation fees pan-India — anchored to the APAC valuation market (~$1.9B, 2024; residential ~75% of transactions). Range ~₹2,500–3,500 cr; exact splits to confirm.",
  funnel: [
    { l: "Whole market", v: 3000, color: "#6366f1" },
    { l: "We can reach", v: 650, color: "#8b5cf6" },
    { l: "3-year target", v: 6, color: "#10b981" },
  ],
  buyers: [
    { label: "Banks & NBFCs (lending)", value: 2400, color: "#1d4ed8" },
    { label: "Investors / M&A / insurance", value: 400, color: "#10b981" },
    { label: "Government / legal (tax, IBC)", value: 200, color: "#0ea5e9" },
  ],
  impact: {
    deltas: [
      { label: "Turnaround per report", before: "2–3 days", after: "same day", gain: "~80% faster" },
      { label: "Analyst time / report", before: "~6 hrs", after: "~1.5 hrs", gain: "~75% less" },
      { label: "Cost to produce", before: "~₹2,000", after: "~₹220", gain: "~9× cheaper" },
      { label: "Throughput / valuer", before: "1–2 / day", after: "4–6 / day", gain: "3–4× capacity" },
    ],
    whyItMatters: [
      "Month- & quarter-end crunch — volume spikes overwhelm valuers; AI absorbs the surge",
      "Audit-ready — every value is source-cited, so audits are faster and liability drops",
      "Cross-document checks — auto-flags area / ownership conflicts a manual review can miss",
      "Consistency — banks get standardized, comparable reports across all panel valuers",
      "Maintenance & tracking — searchable case history instead of scattered files",
    ],
    unlocks: [
      { title: "Small-ticket & rural loans", detail: "cases too costly to value by hand become viable — new volume" },
      { title: "Periodic re-valuations at scale", detail: "banks can re-check collateral portfolios regularly, not rarely" },
      { title: "Instant / digital lending", detail: "same-day valuation enables real-time loan decisions" },
      { title: "Tier-2 / 3 expansion", detail: "serve regions where valuer supply is thin" },
    ],
    note: "Lower cost + faster turnaround expands the reachable market beyond today's ₹650 cr by making volume that was previously uneconomic worth doing.",
  },
  fdv: [
    {
      label: "Feasibility",
      score: 80,
      color: "#10b981",
      state: "Shipped · proven unit economics",
      rows: [
        { s: "ok", t: "Live for residential, commercial, industrial" },
        { s: "ok", t: "Reliable, source-checked AI output" },
        { s: "ok", t: "Gross profit per report", v: "₹180" },
        { s: "ok", t: "Sells ₹200 · costs ₹20" },
        { s: "next", t: "India-based AI infrastructure" },
      ],
      bar: { label: "Gross margin", right: "~90%", parts: [{ pct: 90, color: "#10b981" }] },
      lever: "Move AI to India servers",
      unlocks: "banks trust us",
    },
    {
      label: "Desirability",
      score: 64,
      color: "#f59e0b",
      state: "Demand validated, not yet measured",
      rows: [
        { s: "ok", t: "Pain confirmed in user interviews" },
        { s: "ok", t: "Value delivered per report", v: "₹2,000" },
        { s: "ok", t: "Pricing headroom", v: "→ ₹400+" },
        { s: "next", t: "Measure usage & retention" },
        { s: "next", t: "Validate willingness to pay" },
      ],
      bar: {
        label: "Pains addressed",
        right: "4 of 6",
        parts: [
          { pct: 67, color: "#10b981" },
          { pct: 16, color: "#f59e0b" },
          { pct: 17, color: "#94a3b8" },
        ],
      },
      lever: "Instrument usage & retention",
      unlocks: "validates real demand",
    },
    {
      label: "Viability",
      score: 52,
      color: "#f59e0b",
      state: "Subscription model, revenue unproven",
      rows: [
        { s: "ok", t: "Pay-per-report + monthly plans" },
        { s: "ok", t: "Subscription ARR potential", v: "₹6 cr" },
        { s: "ok", t: "Thousands of valuers to land" },
        { s: "next", t: "Activate recurring billing" },
        { s: "next", t: "Prove retention" },
      ],
      bar: {
        label: "Revenue mix",
        right: "mostly subscription",
        parts: [
          { pct: 84, color: "#1d4ed8" },
          { pct: 16, color: "#10b981" },
        ],
      },
      lever: "Launch subscriptions",
      unlocks: "proves the model",
    },
  ],
  swot: [
    { key: "S", title: "Strengths", color: "#10b981", items: ["Built & live across 3 asset classes", "~90% gross margin per report", "Bank-ready, accurate AI"] },
    { key: "W", title: "Weaknesses", color: "#f43f5e", items: ["Subscriptions not switched on", "No usage tracking yet", "Per-report fee commoditizing"] },
    { key: "O", title: "Opportunities", color: "#1d4ed8", items: ["Comparable-data moat over time", "Cross-sell to feasibility (Atlas)", "Proptech / digital-lending tailwind"] },
    { key: "T", title: "Threats", color: "#f59e0b", items: ["Free / portal AVMs", "Banks' in-house AI", "Low willingness to pay per report"] },
  ],
  team: [
    { name: "Sandeep", role: "CEO / CTO / Head of AI", color: "#5e6ad2" },
    { name: "Jayasaagar", role: "Chief Marketing & Product", color: "#0ea5e9" },
    { name: "Aparna", role: "Product Owner", color: "#a855f7" },
    { name: "Sanjana", role: "AI Engineer", color: "#10b981" },
    { name: "Raunak", role: "Full-stack Engineer", color: "#f59e0b" },
    { name: "Harshith", role: "Infra & Backend", color: "#ef4444" },
  ],
  teamNote: "+ contractors: legal (DPDP), data security, AI advisory, delivery",
  traction: [
    { label: "Product built & live", state: "done" },
    { label: "Grounded AI · 98.4%, 0 hallucinations", state: "done" },
    { label: "Early users & pilots", state: "now" },
    { label: "Recurring revenue", state: "next" },
    { label: "Bank / enterprise deals", state: "next" },
  ],
  trajectory: {
    years: [
      { label: "Year 1", value: 0.5 },
      { label: "Year 2", value: 2.5 },
      { label: "Year 3", value: 6 },
    ],
    note: "Modeled SaaS revenue ramp to the ₹6 cr SOM. Enterprise / custom-build upside sits on top (via Atlas).",
  },
  footer:
    "Prices are real. Market sizes are modeled estimates we still need to confirm — based on public industry and government data. Valuation and feasibility are two related but separate markets (feasibility lives in Atlas).",
};

// ============================ ATLAS · feasibility ============================

const FEASIBILITY: Cfg = {
  eyebrow: "Atlas · CEO Vision · India",
  title: "Bankable project feasibility — TEV, LIE & DPR, on demand.",
  subtitle:
    "Techno-economic viability, lender's-engineer monitoring, and detailed project reports — for banks, government, and investors. The high-value engine.",
  badgeOk: "✓ Demand confirmed",
  badgeWarn: "⚙ Carve-out from Valytica (planned)",
  why: [
    { icon: Landmark, t: "Government capex surging", s: "₹11.1 lakh cr; 9,000+ projects" },
    { icon: TrendingUp, t: "Private capex reviving", s: "~₹4.9 lakh cr intended FY26" },
    { icon: Zap, t: "Every project needs a DPR", s: "banks, schemes, investors" },
  ],
  horizons: [
    { n: "1", title: "Carve out the engine", when: "v0", color: "#1d4ed8", proof: "TEV/LIE/DPR engine out of Valytica" },
    { n: "2", title: "Own the engagement", when: "1–2 years", color: "#7c3aed", proof: "Staged workflow + lender templates" },
    { n: "3", title: "Become the standard", when: "2 years +", color: "#10b981", proof: "Benchmark project data" },
  ],
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
  segmentsNote:
    "Modeled estimate of feasibility / project-report fees pan-India — hundreds of thousands of DPRs/yr (₹35k–₹1.2L each), bank TEV studies, and recurring LIE on 9,000+ government + private projects. Range ~₹3,500–5,500 cr; exact splits to confirm.",
  funnel: [
    { l: "Whole market", v: 4500, color: "#8b5cf6" },
    { l: "We can reach", v: 900, color: "#f59e0b" },
    { l: "3-year target", v: 15, color: "#10b981" },
  ],
  buyers: [
    { label: "Banks & NBFCs", value: 1500, color: "#1d4ed8" },
    { label: "Government & tenders", value: 1500, color: "#0ea5e9" },
    { label: "Private corporates (capex)", value: 1100, color: "#10b981" },
    { label: "Investors / PE", value: 400, color: "#8b5cf6" },
  ],
  fdv: [
    {
      label: "Feasibility",
      score: 75,
      color: "#10b981",
      state: "Engine already built in Valytica",
      rows: [
        { s: "ok", t: "TEV / LIE / DPR engine live" },
        { s: "ok", t: "Declarative financial-model engine" },
        { s: "ok", t: "Chaptered, lender-ready reports" },
        { s: "next", t: "Standalone tenancy & auth" },
        { s: "next", t: "India-based AI infrastructure" },
      ],
      bar: { label: "Build readiness", right: "~70%", parts: [{ pct: 70, color: "#10b981" }] },
      lever: "Carve out + stand up Atlas",
      unlocks: "an independent product",
    },
    {
      label: "Desirability",
      score: 70,
      color: "#10b981",
      state: "Strong, multi-buyer demand",
      rows: [
        { s: "ok", t: "Banks + government + private + investors" },
        { s: "ok", t: "High value per engagement", v: "₹2–50L" },
        { s: "ok", t: "LIE revenue is recurring" },
        { s: "next", t: "Quantify the live pipeline" },
        { s: "next", t: "Cover each lender's format" },
      ],
      bar: { label: "Buyer breadth", right: "4 of 4", parts: [{ pct: 100, color: "#10b981" }] },
      lever: "Build a named pipeline",
      unlocks: "proves real demand",
    },
    {
      label: "Viability",
      score: 55,
      color: "#f59e0b",
      state: "Enterprise model, unproven",
      rows: [
        { s: "ok", t: "Contract value", v: "₹2–50L" },
        { s: "ok", t: "Co-own / managed-support options" },
        { s: "ok", t: "Recurring LIE monitoring revenue" },
        { s: "next", t: "Stand up an enterprise sales motion" },
        { s: "next", t: "Land the first lighthouse client" },
      ],
      bar: {
        label: "Revenue mix",
        right: "mostly enterprise",
        parts: [
          { pct: 20, color: "#1d4ed8" },
          { pct: 80, color: "#10b981" },
        ],
      },
      lever: "Win the first lighthouse client",
      unlocks: "proves the model",
    },
  ],
  swot: [
    { key: "S", title: "Strengths", color: "#10b981", items: ["Engine already built inside Valytica", "Demand across banks/govt/private/investors", "High ACV + recurring LIE revenue"] },
    { key: "W", title: "Weaknesses", color: "#f43f5e", items: ["Not a standalone product yet", "No enterprise sales team", "Pipeline not yet quantified"] },
    { key: "O", title: "Opportunities", color: "#1d4ed8", items: ["Government + private capex surge", "Bank empanelment (Atlas-type firms)", "Benchmark project data over time"] },
    { key: "T", title: "Threats", color: "#f59e0b", items: ["Entrenched consultancies (Resurgent, Sapient)", "Relationship-driven sales", "Trust in AI for large projects"] },
  ],
  footer:
    "Prices/values are indicative; market sizes are modeled estimates to confirm — based on public industry and government data (govt capex, private-capex survey, MSME DPR pricing). Atlas is the planned carve-out of Valytica's feasibility engine.",
};

const CONFIGS: Record<VisionVariant, Cfg> = { valuation: VALUATION, feasibility: FEASIBILITY };

// ============================ shell (scaled slide) ============================

const BASE_W = 1600;
const BASE_H = 920;

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
      <div className="mt-2.5 grid flex-1 auto-rows-fr grid-cols-12 gap-2.5">
        <Panel className="col-span-4" title="The opportunity, by type" icon={Building2}>
          <OpportunityBody cfg={cfg} />
        </Panel>
        <Panel className="col-span-5" title="Feasibility · Desirability · Viability" icon={Check}>
          <FdvBody cfg={cfg} />
        </Panel>
        <Panel className="col-span-3" title="Demand & supply" icon={TrendingUp}>
          <StatsBody cfg={cfg} />
        </Panel>

        {cfg.impact && (
          <Panel className="col-span-5" title="The impact — faster, cheaper, unlocks volume" icon={Rocket}>
            <ImpactBody cfg={cfg} />
          </Panel>
        )}
        <Panel className="col-span-4" title="Where we stand · SWOT" icon={Zap}>
          <SwotBody cfg={cfg} />
        </Panel>
        {cfg.trajectory && (
          <Panel className="col-span-3" title="Financial trajectory" icon={TrendingUp}>
            <TrajectoryBody cfg={cfg} />
          </Panel>
        )}

        <Panel className={cfg.team ? "col-span-4" : "col-span-8"} title="How we grow" icon={Target}>
          <HorizonsBody cfg={cfg} />
        </Panel>
        {cfg.traction && (
          <Panel className="col-span-4" title="Where we are today" icon={Check}>
            <TractionBody cfg={cfg} />
          </Panel>
        )}
        {cfg.team && (
          <Panel className="col-span-4" title="The team" icon={Users}>
            <TeamBody cfg={cfg} />
          </Panel>
        )}
      </div>
      <p className="mt-2 shrink-0 text-[8px] leading-snug text-muted-foreground">{cfg.footer}</p>
    </div>
  );
}

function Header({ cfg }: { cfg: Cfg }) {
  return (
    <div className="-mx-6 -mt-5 flex items-start justify-between gap-5 px-6 py-3.5 text-white" style={{ background: "linear-gradient(115deg,#0b1f3a 0%,#13315c 52%,#1d4ed8 135%)" }}>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-200">{cfg.eyebrow}</div>
        <h1 className="mt-1 text-[26px] font-bold leading-[1.05] tracking-tight">{cfg.title}</h1>
        <p className="mt-1 max-w-[700px] text-[11.5px] leading-snug text-blue-100">{cfg.subtitle}</p>
      </div>
      <div className="flex w-[320px] shrink-0 flex-col gap-1.5">
        <div className="flex items-center justify-end gap-1.5">
          <span className="rounded-full border border-emerald-400/50 bg-emerald-400/15 px-2 py-0.5 text-[9px] font-semibold text-emerald-100">{cfg.badgeOk}</span>
          <span className="rounded-full border border-amber-400/50 bg-amber-400/15 px-2 py-0.5 text-[9px] font-semibold text-amber-100">{cfg.badgeWarn}</span>
        </div>
        {cfg.why.map((w) => (
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

function Panel({ title, icon: Icon, className, children }: { title: string; icon?: React.ComponentType<{ className?: string }>; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex min-h-0 flex-col overflow-hidden rounded-lg border bg-background p-2.5", className)}>
      <h3 className="mb-1.5 flex shrink-0 items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="size-3 text-brand" />}
        {title}
      </h3>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

// ---- bodies ----

function OpportunityBody({ cfg }: { cfg: Cfg }) {
  const total = cfg.segments.reduce((s, x) => s + x.value, 0);
  const bt = cfg.buyers.reduce((s, x) => s + x.value, 0);
  return (
    <div className="flex h-full flex-col gap-1.5">
      <div className="flex items-center gap-2.5">
        <Donut
          data={cfg.segments}
          size={92}
          thickness={13}
          center={
            <div className="text-center">
              <div className="text-[11px] font-bold leading-none">{inCr(total)}</div>
              <div className="text-[7px] text-muted-foreground">per year</div>
            </div>
          }
        />
        <ul className="flex-1 space-y-1">
          {cfg.segments.map((s) => (
            <li key={s.label} className="flex items-center gap-1.5 text-[9px]">
              <span className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{s.label}</span>
              <span className="shrink-0 font-bold tabular-nums">{inCr(s.value)}</span>
              <span className="w-7 shrink-0 text-right text-[8px] text-muted-foreground">{Math.round((s.value / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-auto rounded bg-muted/40 px-1.5 py-1 text-[8.5px] leading-snug text-muted-foreground">
        <span className="font-semibold text-foreground">Buyers: </span>
        {cfg.buyers.map((b) => `${b.label.split(" ")[0]} ${Math.round((b.value / bt) * 100)}%`).join(" · ")}
      </div>
    </div>
  );
}

function FdvBody({ cfg }: { cfg: Cfg }) {
  return (
    <div className="grid h-full grid-cols-3 gap-1.5">
      {cfg.fdv.map((n) => (
        <div key={n.label} className="flex min-h-0 flex-col rounded-md border p-1.5" style={{ borderColor: `${n.color}44`, background: `${n.color}08` }}>
          <div className="flex items-center gap-1.5">
            <Gauge score={n.score} color={n.color} />
            <div className="min-w-0">
              <div className="text-[10px] font-bold leading-none" style={{ color: n.color }}>{n.label}</div>
              <div className="mt-0.5 text-[7.5px] leading-tight text-muted-foreground">{n.state}</div>
            </div>
          </div>
          <ul className="mt-1.5 min-h-0 flex-1 space-y-0.5">
            {n.rows.slice(0, 4).map((r) => {
              const ok = r.s === "ok";
              const Icon = ok ? Check : Circle;
              const color = ok ? "#10b981" : "#f59e0b";
              return (
                <li key={r.t} className="flex items-center gap-1 text-[7.5px] leading-tight">
                  <Icon className="size-2.5 shrink-0" style={{ color }} />
                  <span className="min-w-0 flex-1 truncate text-foreground/90">{r.t}</span>
                  {r.v && <span className="shrink-0 font-bold tabular-nums" style={{ color }}>{r.v}</span>}
                </li>
              );
            })}
          </ul>
          <div className="mt-1 rounded bg-muted/50 px-1 py-0.5 text-[7.5px] font-medium leading-tight" style={{ color: n.color }}>
            → {n.lever}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatsBody({ cfg }: { cfg: Cfg }) {
  return (
    <div className="grid h-full grid-cols-2 gap-1.5">
      {cfg.numbers.map((t) => (
        <div
          key={t.label}
          className={cn(
            "flex flex-col justify-center rounded-md border px-1.5",
            t.tone === "brand" && "border-brand/40 bg-brand/[0.06]",
            t.tone === "emerald" && "border-emerald-500/40 bg-emerald-500/[0.06]",
          )}
        >
          {t.icon && <t.icon className="mb-0.5 size-3 text-brand" />}
          <div className="text-[15px] font-bold leading-none tabular-nums">{t.value}</div>
          <div className="mt-0.5 text-[8px] font-medium leading-tight">{t.label}</div>
          <div className="text-[7.5px] leading-tight text-muted-foreground">{t.sub}</div>
        </div>
      ))}
    </div>
  );
}

function ImpactBody({ cfg }: { cfg: Cfg }) {
  const im = cfg.impact!;
  return (
    <div className="flex h-full flex-col gap-1.5">
      <div className="grid grid-cols-2 gap-1.5">
        {im.deltas.map((d) => (
          <div key={d.label} className="rounded-md border bg-background px-1.5 py-1">
            <div className="text-[7.5px] uppercase tracking-wide text-muted-foreground">{d.label}</div>
            <div className="flex items-baseline gap-1">
              <span className="text-[8px] text-muted-foreground">{d.before}</span>
              <span className="text-[8px] text-emerald-500">→</span>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{d.after}</span>
            </div>
            <div className="text-[7px] font-semibold text-emerald-600 dark:text-emerald-400">{d.gain}</div>
          </div>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        <div className="text-[8px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Unlocks new volume</div>
        <ul className="mt-0.5 grid grid-cols-2 gap-x-2 gap-y-0.5">
          {im.unlocks.map((u) => (
            <li key={u.title} className="flex items-start gap-1 text-[8px] leading-tight">
              <Rocket className="mt-px size-2.5 shrink-0 text-emerald-500" />
              <span className="font-medium">{u.title}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SwotBody({ cfg }: { cfg: Cfg }) {
  return (
    <div className="grid h-full grid-cols-2 grid-rows-2 gap-1.5">
      {cfg.swot.map((q) => (
        <div key={q.key} className="flex min-h-0 flex-col overflow-hidden rounded-md border p-1.5" style={{ borderColor: `${q.color}44` }}>
          <div className="mb-0.5 flex shrink-0 items-center gap-1">
            <span className="grid size-3.5 place-items-center rounded-sm text-[7px] font-bold text-white" style={{ backgroundColor: q.color }}>{q.key}</span>
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

function TrajectoryBody({ cfg }: { cfg: Cfg }) {
  const data: Slice[] = cfg.trajectory!.years.map((y) => ({ label: y.label, value: y.value, color: "#1d4ed8" }));
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <ColumnChart data={data} height={120} format={(n) => `₹${n}cr`} />
      </div>
      <p className="mt-1 text-[7.5px] leading-tight text-muted-foreground">{cfg.trajectory!.note}</p>
    </div>
  );
}

function HorizonsBody({ cfg }: { cfg: Cfg }) {
  return (
    <div className="flex h-full flex-col justify-between gap-1.5">
      {cfg.horizons.map((z) => (
        <div key={z.n} className="flex flex-1 items-center gap-2 rounded-md border px-2" style={{ borderColor: `${z.color}55`, background: `${z.color}0a` }}>
          <span className="text-[12px] font-bold" style={{ color: z.color }}>{z.n}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-[11px] font-semibold leading-tight">{z.title}</span>
              <span className="shrink-0 text-[7.5px] font-medium text-muted-foreground">{z.when}</span>
            </div>
            <div className="truncate text-[8.5px] leading-tight text-muted-foreground">{z.proof}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

const TRACTION_META: Record<"done" | "now" | "next", { color: string; tag: string }> = {
  done: { color: "#10b981", tag: "Done" },
  now: { color: "#1d4ed8", tag: "Now" },
  next: { color: "#94a3b8", tag: "Next" },
};

function TractionBody({ cfg }: { cfg: Cfg }) {
  return (
    <div className="flex h-full flex-col justify-center gap-1.5">
      {cfg.traction!.map((s, i) => {
        const m = TRACTION_META[s.state];
        return (
          <div key={s.label} className="flex items-center gap-2 text-[9px]">
            <span className="grid size-4 shrink-0 place-items-center rounded-full text-white" style={{ backgroundColor: m.color }}>
              {s.state === "done" ? <Check className="size-2.5" /> : <span className="text-[7px] font-bold">{i + 1}</span>}
            </span>
            <span className="min-w-0 flex-1 truncate">{s.label}</span>
            <span className="shrink-0 text-[7px] font-semibold uppercase tracking-wide" style={{ color: m.color }}>{m.tag}</span>
          </div>
        );
      })}
    </div>
  );
}

const initials = (n: string) =>
  n
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

function TeamBody({ cfg }: { cfg: Cfg }) {
  return (
    <div className="flex h-full flex-col gap-1.5">
      <div className="grid flex-1 grid-cols-3 gap-1.5">
        {cfg.team!.map((m) => (
          <div key={m.name} className="flex flex-col items-center justify-center rounded-md border bg-background p-1 text-center">
            <span className="grid size-8 place-items-center rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: m.color }}>{initials(m.name)}</span>
            <div className="mt-1 text-[9px] font-semibold leading-none">{m.name}</div>
            <div className="text-[7px] leading-tight text-muted-foreground">{m.role}</div>
          </div>
        ))}
      </div>
      {cfg.teamNote && <p className="shrink-0 text-[7.5px] leading-tight text-muted-foreground">{cfg.teamNote}</p>}
    </div>
  );
}

function Gauge({ score, color }: { score: number; color: string }) {
  return (
    <Donut
      size={40}
      thickness={5}
      data={[
        { label: "", value: score, color },
        { label: "", value: Math.max(100 - score, 0.001), color: "transparent" },
      ]}
      center={<span className="text-[10px] font-bold" style={{ color }}>{score}</span>}
    />
  );
}
