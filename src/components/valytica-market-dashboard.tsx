"use client";

import { useState } from "react";
import { Building2, Check, Layers, Maximize, Printer, Target, TrendingUp, Zap } from "lucide-react";

import { AreaChart, ChartCard, ColumnChart, Donut, Legend, type Slice } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Valytica · CEO Vision — a single, board-ready page: the north-star vision and
 * horizons, the financial snapshot, market opportunity, competitive landscape,
 * FDV, SWOT, and the pain → desirability → viability story. One page, real
 * graphs, light interactivity, Full screen + Print/PDF.
 *
 * Grounding & honesty:
 * - Pricing (₹200/report, plans) is grounded in Valytica's billing.ts.
 * - Market figures are MODELED ESTIMATES from a fixed base case (verify #122).
 * - IBBI governs the VALUATION leg only; TEV/LIE/DPR is a separate
 *   bank-empanelled consultant (engineer) market, not IBBI.
 * - Competitors & firm counts are from public sources (see footer); the
 *   conversion funnel is uninstrumented (#123) so no funnel numbers are invented.
 */

// ---- model constants ----
const TEV_VOL = 16_000; // TEV/LIE/DPR reports per year (assumption)
const TEV_FEE = 200_000; // ₹ avg fee per project report (assumption)
const REPORT_SW = 200; // ₹ per property report — grounded: REPORT_COST_INR
const TEV_SW = 10_000; // ₹ software value per project report (assumption)
const SAM_FRAC = 0.4; // reachable share of software TAM (assumption)
const INR_PER_USD = 83;
const TIME_SAVED = 0.5; // share of report time Valytica saves (assumption)

// Fixed base case (the old sliders' defaults) — no longer adjustable on the page.
const BASE = { bankVolM: 4, avgFee: 4000, adoptPct: 6 };

// ---- formatting ----
const cr = (v: number) => v / 1e7;
function fmtCr(v: number): string {
  const c = cr(v);
  return `₹${c.toLocaleString("en-IN", { maximumFractionDigits: c < 100 ? 1 : 0 })} cr`;
}
const fmtUsd = (v: number) => `$${(v / INR_PER_USD / 1e6).toFixed(v / INR_PER_USD / 1e6 < 20 ? 1 : 0)}M`;
function fmtMoney(v: number): string {
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return `₹${Math.round(v)}`;
}

// ---- the model, computed once from the base case ----
const bankVol = BASE.bankVolM * 1e6;
const servicesProperty = bankVol * BASE.avgFee;
const servicesTev = TEV_VOL * TEV_FEE;
const servicesTAM = servicesProperty + servicesTev;
const softwareTAM = bankVol * REPORT_SW + TEV_VOL * TEV_SW;
const sam = softwareTAM * SAM_FRAC;
const som = softwareTAM * (BASE.adoptPct / 100);
const valuePerReport = BASE.avgFee * TIME_SAVED;
const captureRatio = REPORT_SW / valuePerReport;

export function ValyticaMarketDashboard() {
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
    const el = document.getElementById("market-onepager") as
      | (HTMLElement & { webkitRequestFullscreen?: () => void })
      | null;
    if (!el) return;
    if (el.requestFullscreen) void el.requestFullscreen();
    else el.webkitRequestFullscreen?.();
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* Toolbar */}
      <div className="mb-3 flex items-center justify-end gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={fullscreenPager}>
          <Maximize className="size-4" /> Full screen
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={printPager}>
          <Printer className="size-4" /> Print / PDF
        </Button>
      </div>

      <div id="market-onepager" className="space-y-3 overflow-hidden rounded-xl border bg-card shadow-sm">
        <VisionHero />
        <div className="space-y-5 px-4 pb-5">
          <Horizons />
          <FinancialSnapshot />
          <MarketOpportunity />
          <Competition />
          <FDV />
          <Swot />
          <BottomRow />
          <p className="text-[9px] leading-snug text-muted-foreground">
            Sources: IBBI registry · RBI · IOV/RVOs · Sigmavalue, Resurgent, Sapient, MITCON, CRISIL/D&amp;B, global
            AVMs. Pricing grounded in billing.ts; market figures modeled (#122); funnel uninstrumented (#123). IBBI
            governs valuation; TEV/LIE/DPR is a separate bank-empanelled consultant market.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================ VISION HERO ============================

function VisionHero() {
  const why = [
    { icon: TrendingUp, t: "Secured lending is rising", s: "~231M retail loans/yr; project finance ~35% of business lending" },
    { icon: Building2, t: "The opinion layer is thin & aging", s: "~6,176 IBBI valuers; fragmented TEV/LIE consultants" },
    { icon: Zap, t: "AI just crossed the line", s: "A defensible, bank-ready opinion can now be machine-drafted" },
  ];
  return (
    <div className="px-5 py-5 text-white" style={{ background: "linear-gradient(115deg,#0b1f3a 0%,#13315c 52%,#1d4ed8 135%)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-200">
          Valytica · CEO Vision · India
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full border border-emerald-400/50 bg-emerald-400/15 px-2 py-0.5 text-[9.5px] font-semibold text-emerald-100">
            ✓ Pain validated
          </span>
          <span className="rounded-full border border-amber-400/50 bg-amber-400/15 px-2 py-0.5 text-[9.5px] font-semibold text-amber-100">
            ⚠ Market modeled
          </span>
        </div>
      </div>

      <h1 className="mt-3 max-w-3xl text-[1.7rem] font-bold leading-tight tracking-tight">
        Trust infrastructure for India&apos;s secured lending.
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-100">
        Every secured loan rests on an independent valuation or feasibility opinion — and that whole layer is manual,
        slow, and unauditable. <span className="font-semibold text-white">Valytica makes every opinion instant,
        consistent, and audit-defensible</span> — across both property valuation and TEV / LIE / DPR feasibility.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {why.map((w) => (
          <div key={w.t} className="rounded-lg border border-white/15 bg-white/[0.06] p-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white">
              <w.icon className="size-3.5 text-blue-200" /> {w.t}
            </div>
            <div className="mt-0.5 text-[10px] leading-snug text-blue-200">{w.s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================ HORIZONS (interactive) ============================

const HORIZONS: { h: string; title: string; when: string; color: string; body: string; proof: string }[] = [
  {
    h: "H1",
    title: "Win the report",
    when: "Now",
    color: "#1d4ed8",
    body: "Be the fastest, most consistent way to produce a valuation or feasibility opinion. Wedge = the validated grind: document extraction, cross-referencing, per-bank formats, audit & volume.",
    proof: "Shipped · ~90% gross margin/report · ₹200 price",
  },
  {
    h: "H2",
    title: "Own the workflow",
    when: "12–24 mo",
    color: "#7c3aed",
    body: "Not one report — the whole pipeline: intake, prior-opinion cross-reference, tracking, versioning, reviewer sign-off. Become the system of record, not a generator.",
    proof: "Ship subscriptions (#119) + close 1–2 enterprise deals",
  },
  {
    h: "H3",
    title: "Become the benchmark",
    when: "24 mo+",
    color: "#10b981",
    body: "A structured corpus of opinions becomes consistency intelligence: “this valuation is 22% above comparable opinions in this corridor.” The layer banks and regulators can’t build themselves.",
    proof: "Data moat · national-comparables gap is the long-term prize",
  },
];

function Horizons() {
  const [active, setActive] = useState(0);
  const cur = HORIZONS[active];
  return (
    <section>
      <SectionHead icon={Target}>The arc — from report to benchmark</SectionHead>
      <div className="grid gap-2 sm:grid-cols-3">
        {HORIZONS.map((z, i) => {
          const on = i === active;
          return (
            <button
              key={z.h}
              onClick={() => setActive(i)}
              aria-pressed={on}
              className={cn(
                "rounded-lg border p-3 text-left transition-all",
                on ? "shadow-sm" : "opacity-70 hover:opacity-100",
              )}
              style={on ? { borderColor: z.color, background: `${z.color}0d` } : undefined}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold" style={{ color: z.color }}>
                  {z.h}
                </span>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                  {z.when}
                </span>
              </div>
              <div className="mt-1 text-[13px] font-semibold">{z.title}</div>
            </button>
          );
        })}
      </div>
      <div className="mt-2 rounded-lg border p-3" style={{ borderColor: `${cur.color}55`, background: `${cur.color}08` }}>
        <p className="text-[13px] leading-relaxed">{cur.body}</p>
        <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: cur.color }}>
          <Check className="size-3.5" /> {cur.proof}
        </div>
      </div>
    </section>
  );
}

// ============================ FINANCIAL SNAPSHOT ============================

function FinancialSnapshot() {
  const stats: { label: string; value: string; sub: string; tone?: "brand" | "emerald" }[] = [
    { label: "Software TAM / yr", value: fmtCr(softwareTAM), sub: fmtUsd(softwareTAM), tone: "brand" },
    { label: "SAM (reachable)", value: fmtCr(sam), sub: `${SAM_FRAC * 100}% of TAM` },
    { label: "SOM · 3-yr ARR", value: fmtCr(som), sub: `${BASE.adoptPct}% capture`, tone: "emerald" },
    { label: "Services market", value: fmtCr(servicesTAM), sub: "enterprise reach" },
    { label: "Price / report", value: "₹200", sub: "grounded · wallet", tone: "brand" },
    { label: "Gross margin", value: "~90%", sub: "₹200 − ~₹20 AI cost", tone: "emerald" },
    { label: "Value / report", value: fmtMoney(valuePerReport), sub: `~${TIME_SAVED * 100}% time saved` },
    { label: "Value capture", value: `~${Math.round(captureRatio * 100)}%`, sub: "price ÷ value · headroom" },
  ];
  return (
    <section>
      <SectionHead icon={TrendingUp}>Financial snapshot</SectionHead>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className={cn(
              "rounded-lg border bg-background p-2.5 transition-colors",
              s.tone === "brand" && "border-brand/40 bg-brand/[0.06]",
              s.tone === "emerald" && "border-emerald-500/40 bg-emerald-500/[0.06]",
            )}
          >
            <div className="text-[9.5px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className="mt-0.5 text-lg font-bold leading-tight tabular-nums">{s.value}</div>
            <div className="text-[9.5px] text-muted-foreground">{s.sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================ MARKET OPPORTUNITY ============================

const FIRMS: { k: string; v: string }[] = [
  { k: "6,176", v: "IBBI registered valuers (all 3 asset classes)" },
  { k: "3,000+", v: "Land & Building valuers — largest class (~half)" },
  { k: "10k+", v: "Wider practicing / bank-empanelled valuer pool" },
  { k: "100s", v: "TEV/LIE/DPR consultancies — majors on 20–38+ bank panels" },
];
const DEMAND: { k: string; v: string }[] = [
  { k: "231M", v: "retail loans/yr (FY22) — secured share drives valuations" },
  { k: "35%", v: "of business lending is project finance (RBI) → TEV/LIE" },
  { k: "$1.18T", v: "India real estate by 2033 (~10.5% CAGR)" },
];

function MarketOpportunity() {
  const services: Slice[] = [
    { label: "Property valuation", value: Math.round(cr(servicesProperty)), color: "#6366f1" },
    { label: "TEV / LIE / DPR", value: Math.round(cr(servicesTev)), color: "#0ea5e9" },
  ];
  const funnel: Slice[] = [
    { label: "TAM", value: Math.round(cr(softwareTAM)), color: "#6366f1" },
    { label: "SAM", value: Math.round(cr(sam)), color: "#8b5cf6" },
    { label: "SOM", value: Math.round(cr(som)), color: "#10b981" },
  ];
  // Illustrative 3-yr SaaS ARR ramp toward the SOM (modeled, not booked).
  const ramp = [
    { label: "Y1", value: cr(som) * 0.2 },
    { label: "Y2", value: cr(som) * 0.5 },
    { label: "Y3", value: cr(som) },
  ];

  return (
    <section>
      <SectionHead icon={Layers}>Market opportunity</SectionHead>
      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="Software opportunity" hint="TAM → SAM → SOM · ₹cr">
          <ColumnChart data={funnel} height={120} format={(n) => `₹${n}cr`} />
          <div className="mt-3">
            <div className="mb-1 text-[10px] font-medium text-muted-foreground">
              Illustrative SaaS ARR ramp <span className="text-muted-foreground/70">(modeled)</span>
            </div>
            <AreaChart data={ramp} height={70} color="#10b981" format={(n) => `₹${n.toFixed(1)}cr`} />
          </div>
        </ChartCard>

        <ChartCard title="Services split & demand" hint="why reports get made">
          <div className="flex items-center gap-3">
            <Donut
              data={services}
              size={92}
              thickness={13}
              center={
                <div>
                  <div className="text-xs font-bold">{fmtCr(servicesTAM)}</div>
                  <div className="text-[9px] text-muted-foreground">services</div>
                </div>
              }
            />
            <Legend data={services} className="flex-col !gap-1.5" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {DEMAND.map((d) => (
              <div key={d.v} className="rounded-md border bg-sky-500/5 px-1.5 py-1 text-center">
                <div className="text-[13px] font-bold leading-none text-sky-600 dark:text-sky-400">{d.k}</div>
                <div className="mt-0.5 text-[8px] leading-tight text-muted-foreground">{d.v.split(" — ")[0]}</div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* who's in the market */}
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {FIRMS.map((f) => (
          <div key={f.v} className="rounded-md bg-muted/50 px-2 py-1.5">
            <div className="text-[15px] font-bold leading-none text-brand">{f.k}</div>
            <div className="mt-0.5 text-[9px] leading-tight text-muted-foreground">{f.v}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================ COMPETITION ============================

const COMP_MAP: { name: string; x: number; y: number; color: string; star?: boolean }[] = [
  { name: "Valytica", x: 84, y: 14, color: "#1d4ed8", star: true },
  { name: "In-house bank AI", x: 76, y: 30, color: "#64748b" },
  { name: "Global AVMs", x: 90, y: 52, color: "#94a3b8" },
  { name: "Sigmavalue", x: 66, y: 60, color: "#6366f1" },
  { name: "Housing/99acres", x: 74, y: 84, color: "#94a3b8" },
  { name: "TEV/LIE firms", x: 22, y: 26, color: "#0ea5e9" },
  { name: "Big advisory", x: 16, y: 44, color: "#94a3b8" },
];
const COMPETITORS: { name: string; tag: string; note: string }[] = [
  { name: "Sigmavalue", tag: "closest", note: "AI valuation + geospatial feasibility + PropGPT" },
  { name: "Resurgent India", tag: "TEV leader", note: "1,500+ TEV/DPR; empanelled with 20+ banks" },
  { name: "Sapient · MITCON · CRISIL", tag: "services", note: "Bank-empanelled consultancies — no product" },
  { name: "Global AVMs · consumer", tag: "off-fit", note: "Zillow/CoreLogic, Housing.com — no India / bank fit" },
];
const WHITE_SPACE =
  "No incumbent is an AI copilot that produces bank-ready, human-in-the-loop, India-resident reports across BOTH valuation and TEV/LIE/DPR. Consumer AVMs aren't defensible; global AVMs lack India fit; services firms have no software.";

function Competition() {
  return (
    <section>
      <SectionHead icon={Target}>Competitive landscape</SectionHead>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border bg-background p-3">
          <PositioningMatrix />
        </div>
        <div className="space-y-2">
          <ul className="space-y-1.5">
            {COMPETITORS.map((c) => (
              <li key={c.name} className="flex items-start gap-2 rounded-lg border bg-background p-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[13px] font-medium">{c.name}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {c.tag}
                    </span>
                  </div>
                  <div className="text-[10.5px] text-muted-foreground">{c.note}</div>
                </div>
              </li>
            ))}
          </ul>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.05] p-2.5">
            <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              White space — Valytica&apos;s wedge
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">{WHITE_SPACE}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================ FDV ============================

const FDV_CHAIN: { key: string; label: string; score: number; color: string; state: string; lever: string; lifts: string }[] = [
  { key: "F", label: "Feasibility", score: 80, color: "#10b981", state: "Strong · built", lever: "Migrate AI to India-region (Vertex/Bedrock)", lifts: "→ credibility for banks & enterprise" },
  { key: "D", label: "Desirability", score: 64, color: "#f59e0b", state: "Pain validated", lever: "Instrument funnel #123 — activation & retention", lifts: "→ proves demand → Viability" },
  { key: "V", label: "Viability", score: 52, color: "#f59e0b", state: "Two engines", lever: "Ship subscriptions #119 + close 1–2 deals", lifts: "→ revenue proof" },
];

function FDV() {
  const fin = [
    "₹200 price − ~₹20 AI cost ≈ ~90% gross margin/report",
    `${fmtMoney(valuePerReport)} value/report · ₹200 = ~${Math.round(captureRatio * 100)}% capture`,
    `SaaS ${fmtCr(som)} ARR · Enterprise ₹20–60L/deal`,
  ];
  return (
    <section>
      <SectionHead icon={Check}>FDV — fix a red, lift the next</SectionHead>
      <div className="rounded-xl border p-3">
        <div className="grid grid-cols-[3.5rem_1fr_1fr_1fr] gap-x-2 gap-y-1.5 text-[10px]">
          <div />
          {FDV_CHAIN.map((n) => (
            <div key={n.key} className="flex items-center justify-center gap-1.5 pb-0.5">
              <Gauge score={n.score} color={n.color} />
              <span className="text-[12px] font-bold" style={{ color: n.color }}>
                {n.label}
              </span>
            </div>
          ))}
          <RowLabel>Status</RowLabel>
          {FDV_CHAIN.map((n) => (
            <Cell key={n.key}>{n.state}</Cell>
          ))}
          <RowLabel>Economics</RowLabel>
          {fin.map((f, i) => (
            <Cell key={i} className="font-semibold text-foreground">
              {f}
            </Cell>
          ))}
          <RowLabel>Lever (red→green)</RowLabel>
          {FDV_CHAIN.map((n) => (
            <Cell key={n.key} style={{ color: n.color }}>
              ⚙ {n.lever}
            </Cell>
          ))}
          <RowLabel>Unlocks</RowLabel>
          {FDV_CHAIN.map((n) => (
            <Cell key={n.key} className="font-medium" style={{ color: n.color }}>
              {n.lifts}
            </Cell>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================ SWOT ============================

const SWOT: { key: string; title: string; color: string; items: string[] }[] = [
  {
    key: "S",
    title: "Strengths",
    color: "#10b981",
    items: [
      "Shipped product spanning valuation + TEV/LIE/DPR",
      "~90% gross margin per report (₹200 − ~₹20 AI cost)",
      "India-resident, human-in-loop, bank-ready outputs",
      "Grounded AI: 98.4% extraction, 0 hallucinations on golden set",
    ],
  },
  {
    key: "W",
    title: "Weaknesses",
    color: "#f43f5e",
    items: [
      "Recurring revenue not live — subscriptions blocked (#119)",
      "Funnel uninstrumented (#123); no WTP / pricing test",
      "Single founder-led GTM; no enterprise sales motion yet (#125)",
      "Market sizing unverified (#122)",
    ],
  },
  {
    key: "O",
    title: "Opportunities",
    color: "#1d4ed8",
    items: [
      "White space: AI + bank-grade + India + both markets",
      "Enterprise custom-build / co-own (₹20–60L ACV)",
      "RBI nudging AI cross-checks in lending",
      "No national comparables DB → long-term data moat",
    ],
  },
  {
    key: "T",
    title: "Threats",
    color: "#f59e0b",
    items: [
      "Sigmavalue — closest AI valuation competitor",
      "Banks building captive in-house AI",
      "Incumbent services firms' panel relationships",
      "Trust in AI for a regulated deliverable unproven at scale",
    ],
  },
];

function Swot() {
  return (
    <section>
      <SectionHead icon={Layers}>SWOT</SectionHead>
      <div className="grid gap-2 sm:grid-cols-2">
        {SWOT.map((q) => (
          <div key={q.key} className="rounded-xl border bg-background p-3" style={{ borderColor: `${q.color}44` }}>
            <div className="mb-1.5 flex items-center gap-1.5">
              <span
                className="grid size-5 place-items-center rounded text-[11px] font-bold text-white"
                style={{ backgroundColor: q.color }}
              >
                {q.key}
              </span>
              <h4 className="text-[12px] font-semibold">{q.title}</h4>
            </div>
            <ul className="space-y-1">
              {q.items.map((it) => (
                <li key={it} className="flex items-start gap-1.5 text-[11px] leading-snug">
                  <span className="mt-1 size-1 shrink-0 rounded-full" style={{ backgroundColor: q.color }} />
                  <span className="text-muted-foreground">{it}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================ BOTTOM ROW: pain · desirability · viability ============================

type Cover = "full" | "partial" | "none";
const COVER_META: Record<Cover, { label: string; color: string }> = {
  full: { label: "Valytica solves", color: "#10b981" },
  partial: { label: "Partial", color: "#f59e0b" },
  none: { label: "Gap", color: "#94a3b8" },
};
const PAIN: { t: string; cover: Cover }[] = [
  { t: "Manual document extraction", cover: "full" },
  { t: "Cross-document conflicts", cover: "full" },
  { t: "Per-bank report formats", cover: "full" },
  { t: "Maintenance · tracking · audit", cover: "full" },
  { t: "Scarce comparables data", cover: "partial" },
  { t: "Inflated / fraud valuations", cover: "none" },
];

type Verdict = "yes" | "assumed" | "no";
const VERDICT_META: Record<Verdict, { color: string; label: string }> = {
  yes: { color: "#10b981", label: "Evidence" },
  assumed: { color: "#f59e0b", label: "Assumed" },
  no: { color: "#f43f5e", label: "Unvalidated" },
};
// 12-point desirability checklist condensed to its verdict mix (full list lives in GTM docs).
const DES_COUNTS: Record<Verdict, number> = { yes: 5, assumed: 3, no: 4 };

const ENGINES: { name: string; short: string; headline: string; unit: string; color: string }[] = [
  { name: "SaaS — self-serve", short: "SaaS · land", headline: "₹5.8 cr", unit: "ARR / yr (SOM)", color: "#1d4ed8" },
  { name: "Enterprise — custom build & co-own", short: "Enterprise", headline: "₹20–60L", unit: "per deal (ACV)", color: "#10b981" },
];

function BottomRow() {
  const painCounts = PAIN.reduce((a, i) => ((a[i.cover] += 1), a), { full: 0, partial: 0, none: 0 } as Record<Cover, number>);
  const painSlices: Slice[] = (["full", "partial", "none"] as Cover[]).map((c) => ({ label: COVER_META[c].label, value: painCounts[c], color: COVER_META[c].color }));
  const desSlices: Slice[] = (["yes", "assumed", "no"] as Verdict[]).map((v) => ({ label: VERDICT_META[v].label, value: DES_COUNTS[v], color: VERDICT_META[v].color }));
  const ENT_REV = 3e7;
  const saasPct = (som / (som + ENT_REV)) * 100;

  return (
    <section>
      <SectionHead icon={Zap}>Pain · Desirability · Viability</SectionHead>
      <div className="grid gap-3 lg:grid-cols-3">
        {/* Pain */}
        <div className="rounded-xl border bg-background p-3">
          <OPHead>Pain points · validated</OPHead>
          <div className="flex items-center gap-2">
            <Donut
              data={painSlices}
              size={64}
              thickness={9}
              center={
                <div className="text-center">
                  <div className="text-[11px] font-bold leading-none">{painCounts.full}/{PAIN.length}</div>
                  <div className="text-[7px] text-muted-foreground">solved</div>
                </div>
              }
            />
            <ul className="flex-1 space-y-0.5">
              {PAIN.map((it) => (
                <li key={it.t} className="flex items-center gap-1 text-[9.5px] leading-tight">
                  <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: COVER_META[it.cover].color }} />
                  <span className="min-w-0 truncate">{it.t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Desirability */}
        <div className="rounded-xl border bg-background p-3">
          <OPHead>Desirability · value</OPHead>
          <div className="flex items-center gap-2">
            <Donut
              data={desSlices}
              size={64}
              thickness={9}
              center={
                <div className="text-center">
                  <div className="text-[11px] font-bold leading-none">{DES_COUNTS.yes}/12</div>
                  <div className="text-[7px] text-muted-foreground">evidenced</div>
                </div>
              }
            />
            <div className="flex-1">
              <div className="mb-0.5 flex items-baseline justify-between text-[8px] text-muted-foreground">
                <span>Value / report</span>
                <span className="font-bold text-foreground">{fmtMoney(valuePerReport)}</span>
              </div>
              <div className="relative h-5 w-full overflow-hidden rounded bg-emerald-500/15">
                <div
                  className="absolute inset-y-0 left-0 flex items-center rounded bg-brand px-1 text-[8px] font-semibold text-white"
                  style={{ width: `${Math.max(captureRatio * 100, 12)}%` }}
                >
                  ₹200
                </div>
              </div>
              <div className="mt-0.5 text-[8px] text-muted-foreground">
                capture <span className="font-bold text-brand">~{Math.round(captureRatio * 100)}%</span> → headroom
              </div>
            </div>
          </div>
        </div>

        {/* Viability */}
        <div className="rounded-xl border bg-background p-3">
          <OPHead>Viability · two engines</OPHead>
          <div className="grid grid-cols-2 gap-1.5">
            {ENGINES.map((e) => (
              <div key={e.name} className="rounded-md border p-1.5 text-center" style={{ borderColor: `${e.color}44`, background: `${e.color}08` }}>
                <div className="text-[9px] font-semibold">{e.short}</div>
                <div className="text-[13px] font-bold leading-tight" style={{ color: e.color }}>
                  {e.headline}
                </div>
                <div className="text-[7.5px] text-muted-foreground">{e.unit}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[8px] text-muted-foreground">Near-term revenue mix (est.)</div>
          <div className="mt-0.5 flex h-4 w-full overflow-hidden rounded text-[8px] font-semibold text-white">
            <div className="flex items-center justify-center" style={{ width: `${saasPct}%`, background: "#1d4ed8" }}>
              SaaS
            </div>
            <div className="flex items-center justify-center" style={{ width: `${100 - saasPct}%`, background: "#10b981" }}>
              Ent.
            </div>
          </div>
          <div className="mt-1 text-[8px] text-muted-foreground">SaaS blocked on #119 · enterprise contract-billed</div>
        </div>
      </div>
    </section>
  );
}

// ============================ shared helpers ============================

function SectionHead({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="size-3.5 text-brand" />
      {children}
    </h3>
  );
}

function OPHead({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</h4>;
}

function RowLabel({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center text-[8.5px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</div>;
}

function Cell({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={cn("rounded border bg-muted/30 px-1.5 py-1 leading-tight", className)} style={style}>
      {children}
    </div>
  );
}

function Gauge({ score, color }: { score: number; color: string }) {
  return (
    <Donut
      size={52}
      thickness={7}
      data={[
        { label: "", value: score, color },
        { label: "", value: Math.max(100 - score, 0.001), color: "transparent" },
      ]}
      center={
        <span className="text-[12px] font-bold" style={{ color }}>
          {score}
        </span>
      }
    />
  );
}

/** 2×2 competitor positioning map: x = manual→AI, y = consumer→bank-grade. */
function PositioningMatrix() {
  return (
    <div className="pl-4 pt-1">
      <div className="relative aspect-[1.7/1] w-full rounded-md border bg-muted/20">
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
        <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-border" />
        <div className="absolute right-0 top-0 h-1/2 w-1/2 rounded-tr-md bg-emerald-500/[0.07]" />
        <span className="absolute right-1.5 top-1 text-[7.5px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
          white space
        </span>
        {COMP_MAP.map((c) => (
          <div
            key={c.name}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1"
            style={{ left: `${c.x}%`, top: `${c.y}%` }}
          >
            <span
              className={cn("shrink-0 rounded-full", c.star ? "size-3 ring-2 ring-brand/30" : "size-2")}
              style={{ backgroundColor: c.color }}
            />
            <span className={cn("whitespace-nowrap text-[8px] leading-none", c.star ? "font-bold text-foreground" : "text-muted-foreground")}>
              {c.name}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-0.5 flex justify-between text-[7.5px] text-muted-foreground">
        <span>Manual / services</span>
        <span>AI / software →</span>
      </div>
      <div className="mt-0.5 text-center text-[7.5px] text-muted-foreground">↑ Bank-grade &amp; defensible · ↓ consumer / generic</div>
    </div>
  );
}
