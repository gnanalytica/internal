"use client";

import { useEffect, useRef, useState } from "react";
import {
  Banknote,
  Building2,
  Check,
  Clock,
  Landmark,
  Layers,
  Maximize,
  Printer,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

import { AreaChart, type Slice } from "@/components/charts";
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
  problem?: string;
  customer?: string;
  badgeOk: string;
  badgeWarn: string;
  why: { icon: React.ComponentType<{ className?: string }>; t: string; s: string }[];
  horizons: { n: string; title: string; when: string; color: string; proof: string }[];
  numbers: Tile[];
  segments: Slice[];
  segmentsNote: string;
  funnel: { l: string; v: number; color: string }[];
  combinedNote?: string;
  buyers: Slice[];
  impact?: {
    deltas: { label: string; before: string; after: string; gain: string }[];
    whyItMatters: string[];
    unlocks: { title: string; detail: string }[];
    note?: string;
  };
  fdv: FdvLens[];
  nabc: { key: string; title: string; subtitle: string; color: string; points: string[]; stats: { v: string; l: string }[] }[];
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
  title: "Valuation reports in minutes — built for India's valuers.",
  subtitle:
    "Residential, commercial, and industrial valuations that are fast, consistent, and bank-ready — the product-led wedge.",
  problem:
    "India's property valuers are buried in manual work — document extraction, per-bank reformatting, month-end crunch — capping their throughput and income while output stays slow and inconsistent, just as the empanelled pool shrinks.",
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
    { label: "Fee per valuation", value: "₹2.5–4k", sub: "borrower pays · bank-mandated", tone: "brand", icon: Banknote },
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
    { l: "We can reach", v: 800, color: "#8b5cf6" },
  ],
  combinedNote: "₹3,000 cr valuation · ₹7,500 cr with feasibility (Atlas)",
  customer: "We sell to: empanelled valuers & firms · banks = later",
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
  nabc: [
    {
      key: "N", title: "Need", subtitle: "Pain — validated", color: "#6366f1",
      points: ["Manual extraction · per-bank formats · month-end crunch", "Inconsistent quality, hard to audit", "Confirmed in user interviews"],
      stats: [{ v: "~5M", l: "valuations / yr" }, { v: "~6,176", l: "valuers — too few" }],
    },
    {
      key: "A", title: "Approach", subtitle: "Our unique solution", color: "#0ea5e9",
      points: ["AI copilot: extract → cross-check → bank-ready report", "Human-in-loop · India-resident · source-cited", "Across residential, commercial & industrial"],
      stats: [{ v: "98.4%", l: "AI accuracy" }, { v: "same day", l: "turnaround" }],
    },
    {
      key: "B", title: "Benefit", subtitle: "Value to the valuer", color: "#10b981",
      points: ["6 hrs → 1.5 hrs per report", "3–4× capacity → more reports & income", "Later: banks get faster, auditable reports"],
      stats: [{ v: "~9× cheaper", l: "₹2,000 → ₹220" }, { v: "₹180", l: "profit / report" }],
    },
    {
      key: "C", title: "Competition", subtitle: "Who we're up against", color: "#f59e0b",
      points: ["Sigmavalue — closest valuer AI", "Manual / spreadsheets (status quo)", "Edge: human-in-loop · India · bank-grade"],
      stats: [{ v: "white space", l: "AI · bank-grade · India" }, { v: "both", l: "valuation + feasibility" }],
    },
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
  subtitle:
    "Techno-economic viability, lender's-engineer monitoring, and detailed project reports — for banks, government, and investors. The high-value engine.",
  problem:
    "Advisory and engineering firms producing TEV / LIE / DPR are stuck with slow, manual, weeks-long studies that cap how many projects they can take on — even as government and private capex surge and bankability stays hard to standardise.",
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
  ],
  combinedNote: "₹4,500 cr feasibility · ₹7,500 cr with valuation (Valytica)",
  customer: "We sell to: advisory & engineering firms · banks/govt = later",
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
        { s: "ok", t: "High-value, repeat engagements" },
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
        { s: "ok", t: "5–10 deals", v: "₹1–5 cr" },
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
const BASE_H = 840;

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
        <Panel title="Where we stand · SWOT" icon={Zap}>
          <SwotBody cfg={cfg} />
        </Panel>
      </div>
      <p className="mt-2 shrink-0 text-[10px] leading-snug text-muted-foreground">{cfg.footer}</p>
    </div>
  );
}

function Header({ cfg }: { cfg: Cfg }) {
  return (
    <div className="-mx-6 -mt-5 px-6 py-5 text-white" style={{ background: "linear-gradient(120deg,#0f172a 0%,#1e293b 50%,#4338ca 130%)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-200">{cfg.eyebrow}</div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full border border-emerald-400/50 bg-emerald-400/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-100">{cfg.badgeOk}</span>
          <span className="rounded-full border border-amber-400/50 bg-amber-400/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-100">{cfg.badgeWarn}</span>
        </div>
      </div>

      <h1 className="mt-2.5 text-[31px] font-bold leading-[1.04] tracking-tight">{cfg.title}</h1>

      {cfg.problem && (
        <p className="mt-3 max-w-[1180px] text-[13px] leading-snug text-indigo-50">
          <span className="mr-1.5 rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
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
      <h3 className="mb-1.5 flex shrink-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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
  const fmax = cfg.funnel[0].v;
  const bt = cfg.buyers.reduce((s, x) => s + x.value, 0);
  return (
    <div className="flex h-full items-stretch gap-4">
      {/* market by type — stacked bar */}
      <div className="flex w-[290px] shrink-0 flex-col justify-center gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Market by type</span>
          <span className="text-[16px] font-bold leading-none">{inCr(total)}/yr</span>
        </div>
        <div className="flex h-7 w-full overflow-hidden rounded-md">
          {cfg.segments.map((s) => (
            <div key={s.label} style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }} title={`${s.label}: ${inCr(s.value)}`} />
          ))}
        </div>
        <ul className="space-y-1">
          {cfg.segments.map((s) => (
            <li key={s.label} className="flex items-center gap-1.5 text-[10.5px]">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{s.label}</span>
              <span className="shrink-0 font-bold tabular-nums">{inCr(s.value)}</span>
              <span className="w-7 shrink-0 text-right text-[9px] text-muted-foreground">{Math.round((s.value / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>

      {/* reachable funnel (shape) + 3-yr area ramp */}
      <div className="flex flex-1 flex-col justify-center gap-2 border-x px-4">
        <div className="space-y-1">
          {cfg.funnel.map((f) => (
            <div
              key={f.l}
              className="mx-auto flex items-center justify-between rounded px-2.5 py-1 text-[10px] font-semibold text-white"
              style={{ width: `${Math.max((f.v / fmax) * 100, 36)}%`, backgroundColor: f.color }}
            >
              <span>{f.l}</span>
              <span className="tabular-nums">{inCr(f.v)}</span>
            </div>
          ))}
        </div>
        {cfg.trajectory && (
          <div className="mt-0.5">
            <div className="mb-0.5 flex items-baseline justify-between text-[10px]">
              <span className="font-medium text-muted-foreground">3-yr revenue ramp</span>
              <span className="font-bold">{inCr(cfg.trajectory.years[cfg.trajectory.years.length - 1].value)} by Y3</span>
            </div>
            <AreaChart
              data={cfg.trajectory.years.map((y) => ({ label: y.label, value: y.value }))}
              color="#10b981"
              height={56}
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
              <div className="text-[16px] font-bold leading-none tabular-nums">{t.value}</div>
              <div className="mt-0.5 text-[9.5px] font-medium leading-tight">{t.label}</div>
              <div className="text-[8.5px] leading-tight text-muted-foreground">{t.sub}</div>
            </div>
          ))}
        </div>
        <div className="text-[9.5px] leading-snug text-muted-foreground">
          <span className="font-semibold text-foreground">Commissioned by: </span>
          {cfg.buyers.map((b) => `${b.label.split(" ")[0]} ${Math.round((b.value / bt) * 100)}%`).join(" · ")}
        </div>
        {cfg.customer && (
          <div className="rounded bg-brand/10 px-1.5 py-0.5 text-[9.5px] font-semibold text-brand">{cfg.customer}</div>
        )}
        {cfg.combinedNote && <div className="text-[9.5px] text-muted-foreground">{cfg.combinedNote}</div>}
      </div>
    </div>
  );
}

function NabcBody({ cfg }: { cfg: Cfg }) {
  return (
    <div className="grid h-full grid-cols-2 grid-rows-2 gap-2">
      {cfg.nabc.map((n) => (
        <div key={n.key} className="flex min-h-0 flex-col rounded-md border p-2" style={{ borderColor: `${n.color}44`, background: `${n.color}07` }}>
          <div className="flex items-center gap-1.5">
            <span className="grid size-6 shrink-0 place-items-center rounded-md text-[13px] font-bold text-white" style={{ backgroundColor: n.color }}>{n.key}</span>
            <div className="min-w-0">
              <div className="text-[12.5px] font-bold leading-none" style={{ color: n.color }}>{n.title}</div>
              <div className="mt-0.5 text-[9px] leading-tight text-muted-foreground">{n.subtitle}</div>
            </div>
          </div>
          <ul className="mt-2 min-h-0 flex-1 space-y-1">
            {n.points.map((p) => (
              <li key={p} className="flex items-start gap-1 text-[10px] leading-snug text-foreground/90">
                <span className="mt-1 size-1 shrink-0 rounded-full" style={{ backgroundColor: n.color }} />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            {n.stats.map((s) => (
              <div key={s.l} className="rounded bg-muted/50 px-1 py-1 text-center">
                <div className="text-[13px] font-bold leading-none" style={{ color: n.color }}>{s.v}</div>
                <div className="mt-0.5 text-[8px] leading-tight text-muted-foreground">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SwotBody({ cfg }: { cfg: Cfg }) {
  return (
    <div className="grid h-full grid-cols-2 grid-rows-2 gap-1.5">
      {cfg.swot.map((q) => (
        <div key={q.key} className="flex min-h-0 flex-col overflow-hidden rounded-md border p-1.5" style={{ borderColor: `${q.color}44` }}>
          <div className="mb-0.5 flex shrink-0 items-center gap-1">
            <span className="grid size-3.5 place-items-center rounded-sm text-[9px] font-bold text-white" style={{ backgroundColor: q.color }}>{q.key}</span>
            <h4 className="text-[11px] font-semibold leading-none">{q.title}</h4>
          </div>
          <ul className="min-h-0 flex-1 space-y-px">
            {q.items.map((it) => (
              <li key={it} className="flex items-start gap-1 text-[9.5px] leading-[1.2] text-muted-foreground">
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
