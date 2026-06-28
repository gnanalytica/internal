"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Maximize, Minus, Printer, RotateCcw, TriangleAlert, X } from "lucide-react";

import { ChartCard, Donut, Legend, type Slice } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Valytica · Market & Strategy — an interactive strategy dashboard with a
 * print-ready one-pager.
 *
 * Grounding & honesty:
 * - Market figures are MODELED ESTIMATES driven by the sliders (verify #122).
 * - IBBI governs the VALUATION leg only; TEV/LIE/DPR is a separate
 *   bank-empanelled consultant market (engineers), not IBBI.
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

const DEFAULTS = { bankVolM: 4, avgFee: 4000, adoptPct: 6 };
const STORAGE_KEY = "valytica-market:v2";

// ---- formatting ----
const cr = (v: number) => v / 1e7;
function fmtCr(v: number): string {
  const c = cr(v);
  return `₹${c.toLocaleString("en-IN", { maximumFractionDigits: c < 100 ? 1 : 0 })} cr`;
}
const fmtUsd = (v: number) => `$${(v / INR_PER_USD / 1e6).toFixed(v / INR_PER_USD / 1e6 < 20 ? 1 : 0)}M`;

type Section = "sizing" | "competitors" | "pain" | "fdv" | "gtm";
const SECTIONS: { id: Section; label: string }[] = [
  { id: "sizing", label: "Market opportunity" },
  { id: "competitors", label: "Competitors" },
  { id: "pain", label: "Pain points" },
  { id: "fdv", label: "Desirability" },
  { id: "gtm", label: "Viability & GTM" },
];

type Model = {
  bankVol: number; servicesProperty: number; servicesTev: number; servicesTAM: number;
  swProperty: number; swTev: number; softwareTAM: number; sam: number; som: number;
  swingLo: number; swingHi: number; valuePerReport: number; captureRatio: number;
};

export function ValyticaMarketDashboard() {
  const [mode, setMode] = useState<"interactive" | "onepager">("interactive");
  const [section, setSection] = useState<Section>("sizing");
  const [bankVolM, setBankVolM] = useState(DEFAULTS.bankVolM);
  const [avgFee, setAvgFee] = useState(DEFAULTS.avgFee);
  const [adoptPct, setAdoptPct] = useState(DEFAULTS.adoptPct);
  const loaded = useRef(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (s) {
        if (typeof s.bankVolM === "number") setBankVolM(s.bankVolM);
        if (typeof s.avgFee === "number") setAvgFee(s.avgFee);
        if (typeof s.adoptPct === "number") setAdoptPct(s.adoptPct);
      }
    } catch {
      // ignore malformed storage
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ bankVolM, avgFee, adoptPct }));
    } catch {
      // storage may be unavailable
    }
  }, [bankVolM, avgFee, adoptPct]);

  const m: Model = useMemo(() => {
    const bankVol = bankVolM * 1e6;
    const servicesProperty = bankVol * avgFee;
    const servicesTev = TEV_VOL * TEV_FEE;
    const servicesTAM = servicesProperty + servicesTev;
    const swProperty = bankVol * REPORT_SW;
    const swTev = TEV_VOL * TEV_SW;
    const softwareTAM = swProperty + swTev;
    const sam = softwareTAM * SAM_FRAC;
    const som = softwareTAM * (adoptPct / 100);
    const swingLo = 2e6 * avgFee + servicesTev;
    const swingHi = 6e6 * avgFee + servicesTev;
    const valuePerReport = avgFee * TIME_SAVED;
    const captureRatio = REPORT_SW / valuePerReport;
    return { bankVol, servicesProperty, servicesTev, servicesTAM, swProperty, swTev, softwareTAM, sam, som, swingLo, swingHi, valuePerReport, captureRatio };
  }, [bankVolM, avgFee, adoptPct]);

  const reset = () => {
    setBankVolM(DEFAULTS.bankVolM);
    setAvgFee(DEFAULTS.avgFee);
    setAdoptPct(DEFAULTS.adoptPct);
  };

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
      {/* View toggle */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
          {(["interactive", "onepager"] as const).map((md) => (
            <button
              key={md}
              onClick={() => setMode(md)}
              aria-pressed={mode === md}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                mode === md ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {md === "interactive" ? "Interactive" : "One-pager"}
            </button>
          ))}
        </div>
        {mode === "onepager" && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={fullscreenPager}>
              <Maximize className="size-4" /> Full screen
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={printPager}>
              <Printer className="size-4" /> Print / PDF
            </Button>
          </div>
        )}
      </div>

      {mode === "onepager" ? (
        <OnePager m={m} />
      ) : (
        <>
          <header className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">India property valuation &amp; feasibility-report market</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Two markets — IBBI-regulated property valuation and bank-empanelled TEV/LIE/DPR — and Valytica spans
                both. Figures are a model you can adjust; market data is being verified.
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              Modeled estimates · verify (#122)
            </span>
          </header>

          <div className="mb-5 flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                aria-pressed={section === s.id}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  section === s.id ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {section === "sizing" && (
            <Sizing m={m} bankVolM={bankVolM} setBankVolM={setBankVolM} avgFee={avgFee} setAvgFee={setAvgFee} adoptPct={adoptPct} setAdoptPct={setAdoptPct} reset={reset} />
          )}
          {section === "competitors" && <Competitors />}
          {section === "pain" && <PainPoints />}
          {section === "fdv" && <Desirability m={m} />}
          {section === "gtm" && <GoToMarket m={m} />}
        </>
      )}
    </div>
  );
}

// ============================ shared data ============================

const FIRMS: { k: string; v: string }[] = [
  { k: "~6,176", v: "IBBI registered valuers (all 3 asset classes)" },
  { k: "~3,000+", v: "Land & Building valuers — largest class (~half)" },
  { k: "10,000s", v: "Wider practicing / bank-empanelled valuer pool (IOV etc.)" },
  { k: "100s", v: "TEV/LIE/DPR consultancies — fragmented; majors on 20–38+ bank panels" },
];
const DEMAND: { k: string; v: string }[] = [
  { k: "~231M", v: "retail loans/yr (FY22) — secured share drives valuations" },
  { k: "~35%", v: "of business lending is project finance (RBI) → TEV/LIE" },
  { k: "$1.18T", v: "India real estate by 2033 (~10.5% CAGR)" },
];

const COMPETITORS: { group: string; accent: string; items: { name: string; tag: string; note: string }[] }[] = [
  {
    group: "Valuation / AVM",
    accent: "#6366f1",
    items: [
      { name: "Sigmavalue", tag: "India · closest", note: "AI valuation engine + geospatial feasibility + PropGPT" },
      { name: "Housing.com / 99acres", tag: "consumer", note: "Listing price estimates — not bank-grade / defensible" },
      { name: "Zillow · HouseCanary · CoreLogic", tag: "global AVM", note: "US-only; no India residency or bank formats" },
      { name: "Colliers · C&W · CBRE · Knight Frank", tag: "advisory", note: "High-end commercial, not bank-mandated volume" },
      { name: "In-house bank AI", tag: "captive", note: "RBI nudging AI cross-checks; not a product for valuers" },
    ],
  },
  {
    group: "Feasibility — TEV / LIE / DPR",
    accent: "#0ea5e9",
    items: [
      { name: "Resurgent India", tag: "leader", note: "1,500+ TEV/DPR; empanelled with 20+ banks" },
      { name: "Sapient · Shreekari · Almondz · NITCON", tag: "national", note: "Bank-empanelled TEV/LIE consultancies (38+ banks)" },
      { name: "MITCON · APITCO · ITCOT", tag: "govt TCOs", note: "State technical consultancy orgs — DPR/TEV" },
      { name: "CRISIL · Dun & Bradstreet", tag: "large", note: "Ratings/advisory majors; high-end appraisal" },
    ],
  },
];
const WHITE_SPACE =
  "No incumbent is an AI copilot for the valuer/consultant that produces bank-ready, human-in-the-loop, India-resident reports across BOTH valuation and TEV/LIE/DPR. Consumer AVMs aren't defensible; global AVMs lack India fit; services firms have no software.";

// FDV as a linked chain — each red is a lever that lifts the next lens.
const FDV_CHAIN: { key: string; label: string; score: number; color: string; state: string; lever: string; leverShort: string; lifts: string }[] = [
  { key: "F", label: "Feasibility", score: 80, color: "#10b981", state: "Strong", lever: "Migrate AI to India-region (Vertex/Bedrock); promote off Flash-Lite", leverShort: "India-region AI", lifts: "→ credibility for banks & enterprise" },
  { key: "D", label: "Desirability", score: 64, color: "#f59e0b", state: "Pain validated", lever: "Instrument funnel #123 — activation & retention", leverShort: "Instrument #123", lifts: "→ proves demand → Viability" },
  { key: "V", label: "Viability", score: 52, color: "#f59e0b", state: "Two engines", lever: "Ship subscriptions #119 + close 1–2 enterprise deals", leverShort: "Ship #119 + deals", lifts: "→ revenue proof" },
];

// Competitor positioning map (one-pager): x = manual→AI, y = consumer→bank-grade.
const COMP_MAP: { name: string; x: number; y: number; color: string; star?: boolean }[] = [
  { name: "Valytica", x: 84, y: 14, color: "#1d4ed8", star: true },
  { name: "In-house bank AI", x: 76, y: 30, color: "#64748b" },
  { name: "Global AVMs", x: 90, y: 52, color: "#94a3b8" },
  { name: "Sigmavalue", x: 66, y: 60, color: "#6366f1" },
  { name: "Housing/99acres", x: 74, y: 84, color: "#94a3b8" },
  { name: "TEV/LIE firms", x: 22, y: 26, color: "#0ea5e9" },
  { name: "Big advisory", x: 16, y: 44, color: "#94a3b8" },
];

const ENGINES: { name: string; color: string; pricing: string[]; econ: string; note: string }[] = [
  {
    name: "SaaS — self-serve (land)",
    color: "#1d4ed8",
    pricing: ["Free — 3 watermarked reports", "Individual — ₹499/mo", "Team — ₹1,999/mo", "Pay-per-report — ₹200 wallet"],
    econ: "Blended ARPU ~₹10–25k/yr · SOM ~₹5.8 cr ARR",
    note: "Recurring revenue blocked until subscriptions ship (#119).",
  },
  {
    name: "Enterprise — custom build & co-own",
    color: "#10b981",
    pricing: ["Custom build (one-time)", "+ AMC / managed support", "+ co-own / revenue-share", "Contract-billed (not Razorpay)"],
    econ: "ACV ~₹20–60 L · 5–10 deals → ₹1–5 cr (est.)",
    note: "Sales-led; taps the services market; needs GST (#120) + ToS (#121).",
  },
];

const BLOCKERS: { id: number; t: string; type: string; color: string }[] = [
  { id: 119, t: "Razorpay subscriptions", type: "engineering", color: "#5e6ad2" },
  { id: 120, t: "GST invoices", type: "finance", color: "#14b8a6" },
  { id: 121, t: "ToS & privacy", type: "legal", color: "#ef4444" },
  { id: 122, t: "Market research", type: "research", color: "#0ea5e9" },
  { id: 123, t: "Funnel events", type: "product", color: "#8b5cf6" },
  { id: 125, t: "Enterprise sales motion", type: "sales", color: "#10b981" },
];

// ============================ SIZING ============================

function Sizing({
  m, bankVolM, setBankVolM, avgFee, setAvgFee, adoptPct, setAdoptPct, reset,
}: {
  m: Model; bankVolM: number; setBankVolM: (n: number) => void; avgFee: number; setAvgFee: (n: number) => void;
  adoptPct: number; setAdoptPct: (n: number) => void; reset: () => void;
}) {
  const servicesSlices: Slice[] = [
    { label: "Property valuation", value: Math.round(cr(m.servicesProperty)), color: "#6366f1" },
    { label: "TEV / LIE / DPR", value: Math.round(cr(m.servicesTev)), color: "#0ea5e9" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Services market / yr" value={fmtCr(m.servicesTAM)} sub={fmtUsd(m.servicesTAM)} tone="muted" hint="Fees valuers/consultants earn" />
        <StatCard label="Software TAM / yr" value={fmtCr(m.softwareTAM)} sub={fmtUsd(m.softwareTAM)} tone="brand" hint="Valytica's revenue ceiling" />
        <StatCard label="SOM · 3-yr ARR" value={fmtCr(m.som)} sub={`${adoptPct}% capture`} tone="emerald" hint="Realistic near-term target" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard title="Software opportunity" hint="TAM → SAM → SOM" className="lg:col-span-3">
          <div className="space-y-3 pt-1">
            <FunnelBar label="TAM — total software market" value={m.softwareTAM} pct={100} color="#6366f1" note="every report on a tool" />
            <FunnelBar label="SAM — reachable valuers/firms" value={m.sam} pct={SAM_FRAC * 100} color="#8b5cf6" note={`${SAM_FRAC * 100}% adoptable`} />
            <FunnelBar label="SOM — 3-yr realistic capture" value={m.som} pct={adoptPct} color="#10b981" note={`${adoptPct}% of TAM`} />
          </div>
          <p className="mt-3 rounded-lg border border-brand/20 bg-brand/5 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Two engines.</span> SaaS captures the software TAM ({fmtCr(m.softwareTAM)}); the enterprise
            build / co-own arm addresses the far larger services market ({fmtCr(m.servicesTAM)}) per deal — sized separately.
          </p>
        </ChartCard>

        <ChartCard title="Assumptions" hint="drag to model" className="lg:col-span-2">
          <div className="space-y-4 pt-1">
            <RangeRow label="Bank valuations / yr" value={`${bankVolM.toFixed(1)}M`} min={2} max={6} step={0.5} v={bankVolM} onChange={setBankVolM} confidence="low" />
            <RangeRow label="Avg fee / valuation" value={`₹${avgFee.toLocaleString("en-IN")}`} min={2500} max={6000} step={250} v={avgFee} onChange={setAvgFee} confidence="med" />
            <RangeRow label="3-yr capture (SOM)" value={`${adoptPct}%`} min={1} max={15} step={0.5} v={adoptPct} onChange={setAdoptPct} confidence="low" />
            <button onClick={reset} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <RotateCcw className="size-3.5" /> Reset to base case
            </button>
          </div>
        </ChartCard>
      </div>

      {/* Market structure — firms & demand */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ChartCard title="Who's in the market — firms" hint="supply side">
          <ul className="space-y-2">
            {FIRMS.map((f) => (
              <li key={f.v} className="flex items-baseline gap-3">
                <span className="w-16 shrink-0 text-right font-mono text-sm font-bold text-brand">{f.k}</span>
                <span className="text-[12px] leading-snug text-muted-foreground">{f.v}</span>
              </li>
            ))}
          </ul>
        </ChartCard>
        <ChartCard title="Demand drivers" hint="why reports get made">
          <ul className="space-y-2">
            {DEMAND.map((d) => (
              <li key={d.v} className="flex items-baseline gap-3">
                <span className="w-16 shrink-0 text-right font-mono text-sm font-bold text-sky-500">{d.k}</span>
                <span className="text-[12px] leading-snug text-muted-foreground">{d.v}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-4">
            <Donut data={servicesSlices} size={96} thickness={13} center={<div><div className="text-xs font-bold">{fmtCr(m.servicesTAM)}</div><div className="text-[9px] text-muted-foreground">services</div></div>} />
            <Legend data={servicesSlices} className="flex-col !gap-1.5" />
          </div>
        </ChartCard>
      </div>

      <SourceNote>
        IBBI governs the <span className="font-medium text-foreground">valuation</span> leg; TEV/LIE/DPR is a separate
        bank-empanelled consultant market. Verify counts at IBBI registry, RBI (lending/project-finance), IOV/RVOs.
      </SourceNote>
    </div>
  );
}

function FunnelBar({ label, value, pct, color, note }: { label: string; value: number; pct: number; color: string; note: string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums font-semibold">{fmtCr(value)}</span>
      </div>
      <div className="h-7 w-full overflow-hidden rounded-md bg-muted/60">
        <div
          className="flex h-full items-center justify-end rounded-md px-2 text-[10px] font-medium text-white transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: color }}
        >
          <span className="opacity-90">{note}</span>
        </div>
      </div>
    </div>
  );
}

function RangeRow({ label, value, min, max, step, v, onChange, confidence }: {
  label: string; value: string; min: number; max: number; step: number; v: number; onChange: (n: number) => void; confidence: "low" | "med";
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium">{label}</span>
        <span className="flex items-center gap-1.5">
          <span className="tabular-nums text-xs font-semibold text-brand">{value}</span>
          <span className={cn("rounded px-1 text-[9px] font-semibold uppercase", confidence === "low" ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400")}>
            {confidence === "low" ? "low conf" : "med conf"}
          </span>
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} className="w-full accent-[var(--brand)]" />
    </div>
  );
}

function StatCard({ label, value, sub, hint, tone }: { label: string; value: string; sub?: string; hint?: string; tone: "brand" | "emerald" | "muted" }) {
  const ring = tone === "brand" ? "border-brand/40 bg-brand/[0.06]" : tone === "emerald" ? "border-emerald-500/40 bg-emerald-500/[0.06]" : "";
  return (
    <div className={cn("rounded-xl border bg-background p-4", ring)}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums">{value}</span>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function SourceNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
      <span className="font-semibold text-foreground">Sources / next step — </span>
      {children}
    </p>
  );
}

// ============================ COMPETITORS ============================

function Competitors() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {COMPETITORS.map((g) => (
          <ChartCard key={g.group} title={g.group}>
            <ul className="space-y-2.5">
              {g.items.map((c) => (
                <li key={c.name} className="flex items-start gap-2.5">
                  <span className="mt-1 size-2 shrink-0 rounded-full" style={{ backgroundColor: g.accent }} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium">{c.name}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{c.tag}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">{c.note}</div>
                  </div>
                </li>
              ))}
            </ul>
          </ChartCard>
        ))}
      </div>
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] p-4">
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">White space — Valytica&apos;s wedge</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{WHITE_SPACE}</p>
      </div>
      <SourceNote>
        Public sources: Sigmavalue, Resurgent India, Sapient, MITCON/APITCO, CRISIL/D&B; global AVMs (Zillow, HouseCanary,
        CoreLogic). A full competitor + pricing scan is tracked in #122.
      </SourceNote>
    </div>
  );
}

// ============================ PAIN POINTS ============================

type Cover = "full" | "partial" | "none";
const COVER_META: Record<Cover, { label: string; color: string }> = {
  full: { label: "Valytica solves", color: "#10b981" },
  partial: { label: "Partial", color: "#f59e0b" },
  none: { label: "Gap", color: "#94a3b8" },
};

const PAIN: { group: string; accent: string; items: { t: string; impact: string; cover: Cover }[] }[] = [
  {
    group: "Valuer (primary user)",
    accent: "#6366f1",
    items: [
      { t: "Manual document extraction (deeds, EC, tax, plans) — poor scans, regional languages", impact: "Biggest time sink; error-prone", cover: "full" },
      { t: "Cross-document inconsistencies (area, ownership chain)", impact: "Manual reconciliation; liability if missed", cover: "full" },
      { t: "Per-bank report formats (SBI, HDFC… each different)", impact: "Reformatting every report by hand", cover: "full" },
      { t: "Maintenance, tracking & audit across high case volume", impact: "Validated pain — time & defensibility", cover: "full" },
      { t: "Scarce / unreliable comparable sales data", impact: "Circle-vs-market gap; relies on brokers/memory", cover: "partial" },
    ],
  },
  {
    group: "Bank (demand source)",
    accent: "#0ea5e9",
    items: [
      { t: "Inconsistent quality across panel valuers", impact: "Hard to trust / compare reports", cover: "partial" },
      { t: "Inflated / fraudulent valuations", impact: "Collateral shortfall → NPA losses", cover: "none" },
      { t: "Slow valuation TAT delays disbursal", impact: "Friction in loan processing", cover: "full" },
    ],
  },
  {
    group: "Systemic (deep / unsolved)",
    accent: "#f43f5e",
    items: [
      { t: "No national comparable-transaction database", impact: "Root cause of valuation subjectivity", cover: "partial" },
      { t: "Circle (guideline) value vs market value divergence", impact: "Defensibility gap", cover: "none" },
    ],
  },
];

function PainPoints() {
  const counts = PAIN.flatMap((g) => g.items).reduce((a, i) => ((a[i.cover] += 1), a), { full: 0, partial: 0, none: 0 } as Record<Cover, number>);
  const slices: Slice[] = (["full", "partial", "none"] as Cover[]).map((c) => ({ label: COVER_META[c].label, value: counts[c], color: COVER_META[c].color }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Coverage" hint="of mapped pains" className="lg:col-span-1">
          <div className="flex items-center gap-4">
            <Donut data={slices} center={<div><div className="text-sm font-bold">{counts.full}/{slices.reduce((s, x) => s + x.value, 0)}</div><div className="text-[10px] text-muted-foreground">solved</div></div>} />
            <Legend data={slices} className="flex-col !gap-1.5" />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Valytica&apos;s wedge is the valuer&apos;s document-to-report grind (now user-validated). The deepest gaps —
            comparables data &amp; bank-side fraud/QA — are the long-term moat.
          </p>
        </ChartCard>
        <div className="space-y-4 lg:col-span-2">
          {PAIN.map((g) => (
            <div key={g.group} className="rounded-xl border bg-background p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: g.accent }} />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.group}</h3>
              </div>
              <ul className="space-y-2">
                {g.items.map((it) => (
                  <li key={it.t} className="flex items-start gap-2.5">
                    <CoverDot cover={it.cover} />
                    <div className="min-w-0">
                      <div className="text-sm leading-snug">{it.t}</div>
                      <div className="text-[11px] text-muted-foreground">{it.impact}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CoverDot({ cover }: { cover: Cover }) {
  const meta = COVER_META[cover];
  return (
    <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full" style={{ backgroundColor: `${meta.color}22` }} title={meta.label}>
      {cover === "full" ? <Check className="size-3" style={{ color: meta.color }} /> : cover === "partial" ? <Minus className="size-3" style={{ color: meta.color }} /> : <X className="size-3" style={{ color: meta.color }} />}
    </span>
  );
}

// ============================ DESIRABILITY / FDV ============================

type Verdict = "yes" | "assumed" | "no";
const VERDICT_META: Record<Verdict, { color: string; label: string }> = {
  yes: { color: "#10b981", label: "Evidence" },
  assumed: { color: "#f59e0b", label: "Assumed" },
  no: { color: "#f43f5e", label: "Unvalidated" },
};

const CHECKLIST: { q: string; v: Verdict; note: string }[] = [
  { q: "Problem is real and painful", v: "yes", note: "User interviews: maintenance, cross-reference, tracking, audit, time, volume" },
  { q: "Need is frequent & high-volume", v: "yes", note: "Recurring, high-volume workload confirmed with users" },
  { q: "Fits the user's actual workflow", v: "yes", note: "Validated pains map to the real valuation workflow" },
  { q: "Value prop differentiated & clear", v: "yes", note: "Residency, human-in-loop, bank-ready outputs" },
  { q: "Low adoption friction", v: "yes", note: "OTP sign-in, org-of-one, 3 free reports" },
  { q: "Target user (ICP) clearly defined", v: "assumed", note: "Sharper after interviews; two ICPs (valuers + consultants) — #122" },
  { q: "Users will trust AI in a regulated deliverable", v: "assumed", note: "Architecture earns it; adoption at scale untested" },
  { q: "Reachable via a channel", v: "assumed", note: "WhatsApp + enterprise outreach; reply-rate unproven" },
  { q: "Users already seek a solution today", v: "no", note: "Status-quo / alternatives not yet mapped" },
  { q: "Evidence of demand (usage / retention)", v: "no", note: "Only $pageview tracked — #123" },
  { q: "Willingness-to-pay signals", v: "no", note: "Pain validated; pricing not yet tested — #119 / #124" },
  { q: "Referral / word-of-mouth potential", v: "no", note: "No NPS / feedback / referral instrumented" },
];

function Desirability({ m }: { m: Model }) {
  const counts = CHECKLIST.reduce((a, c) => ((a[c.v] += 1), a), { yes: 0, assumed: 0, no: 0 } as Record<Verdict, number>);
  const slices: Slice[] = (["yes", "assumed", "no"] as Verdict[]).map((v) => ({ label: VERDICT_META[v].label, value: counts[v], color: VERDICT_META[v].color }));

  return (
    <div className="space-y-4">
      {/* Value-of-time financials */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Value created / report" value={fmtMoney(m.valuePerReport)} sub={`~${TIME_SAVED * 100}% time saved`} tone="emerald" hint="On a ₹4k fee (assumption)" />
        <StatCard label="Valytica price / report" value="₹200" sub="grounded" tone="brand" hint="Prepaid wallet" />
        <StatCard label="Value capture" value={`~${Math.round(m.captureRatio * 100)}%`} sub="price ÷ value" tone="muted" hint="Healthy — strong willingness headroom" />
      </div>

      {/* FDV linked chain */}
      <FDVChain />

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Desirability signals" hint="12 checks" className="lg:col-span-1">
          <div className="flex items-center gap-4">
            <Donut data={slices} center={<div><div className="text-sm font-bold">{counts.yes}/12</div><div className="text-[10px] text-muted-foreground">evidenced</div></div>} />
            <Legend data={slices} className="flex-col !gap-1.5" />
          </div>
        </ChartCard>
        <div className="rounded-xl border bg-background p-4 lg:col-span-2">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Desirability checklist</h3>
          <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {CHECKLIST.map((c) => (
              <li key={c.q} className="flex items-start gap-2.5">
                <VerdictBadge v={c.v} />
                <div className="min-w-0">
                  <div className="text-sm leading-snug">{c.q}</div>
                  <div className="text-[11px] text-muted-foreground">{c.note}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** The three FDV lenses as a connected chain: each lever turns a red green and
 * lifts the next lens. */
function FDVChain() {
  return (
    <ChartCard title="FDV — linked: turn reds green, each lever lifts the next" hint="Feasibility → Desirability → Viability">
      <div className="flex flex-col items-stretch gap-2 lg:flex-row lg:items-center">
        {FDV_CHAIN.map((n, i) => (
          <div key={n.key} className="flex flex-1 items-center gap-2">
            <div className="flex-1 rounded-lg border p-3">
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-sm font-semibold">{n.label}</span>
                <span className="text-[11px] text-muted-foreground">{n.state}</span>
              </div>
              <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-muted/60">
                <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${n.score}%`, backgroundColor: n.color }} />
              </div>
              <div className="text-[11px] leading-snug">
                <span className="font-medium text-foreground">Lever:</span> <span className="text-muted-foreground">{n.lever}</span>
              </div>
              <div className="mt-0.5 text-[11px] font-medium" style={{ color: n.color }}>{n.lifts}</div>
            </div>
            {i < FDV_CHAIN.length - 1 && <ArrowRight className="hidden size-5 shrink-0 text-muted-foreground lg:block" />}
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

function VerdictBadge({ v }: { v: Verdict }) {
  const meta = VERDICT_META[v];
  return (
    <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full" style={{ backgroundColor: `${meta.color}22` }} title={meta.label}>
      {v === "yes" ? <Check className="size-3" style={{ color: meta.color }} /> : v === "assumed" ? <TriangleAlert className="size-3" style={{ color: meta.color }} /> : <X className="size-3" style={{ color: meta.color }} />}
    </span>
  );
}

// ============================ VIABILITY & GTM ============================

function GoToMarket({ m }: { m: Model }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {ENGINES.map((e) => (
          <div key={e.name} className="rounded-xl border bg-background p-4" style={{ borderColor: `${e.color}55` }}>
            <div className="mb-2 flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: e.color }} />
              <h3 className="text-sm font-semibold">{e.name}</h3>
            </div>
            <ul className="mb-2 space-y-1">
              {e.pricing.map((p) => (
                <li key={p} className="flex items-center gap-2 text-[12px]">
                  <span className="size-1 rounded-full bg-muted-foreground/50" />
                  {p}
                </li>
              ))}
            </ul>
            <div className="rounded-md px-2 py-1.5 text-[11px] font-medium" style={{ backgroundColor: `${e.color}12`, color: e.color }}>{e.econ}</div>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{e.note}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Combined opportunity" hint="two engines">
          <div className="space-y-3 pt-1">
            <FunnelBar label="Software TAM (SaaS engine)" value={m.softwareTAM} pct={100} color="#1d4ed8" note="₹200/report + plans" />
            <FunnelBar label="Services market (enterprise reach)" value={m.servicesTAM} pct={100} color="#10b981" note="custom build / co-own" />
            <FunnelBar label="SOM — 3-yr SaaS ARR" value={m.som} pct={Math.min((m.som / m.softwareTAM) * 100, 100)} color="#8b5cf6" note="" />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            SaaS lands many small accounts; enterprise expands into few high-ACV deals against the much larger services market.
          </p>
        </ChartCard>
        <ChartCard title="Launch blockers & tasks" hint="GTM milestone">
          <ul className="space-y-1.5">
            {BLOCKERS.map((b) => (
              <li key={b.id} className="flex items-center gap-2.5 text-sm">
                <span className="font-mono text-[11px] text-muted-foreground">#{b.id}</span>
                <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ color: b.color, backgroundColor: `${b.color}1f` }}>{b.type}</span>
                <span className="min-w-0 flex-1 truncate">{b.t}</span>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>
      <SourceNote>Pricing grounded in billing.ts (SaaS). Enterprise ACV is an estimate to validate (#122/#125). Motion: WhatsApp → free sample → wallet/plan; enterprise → sales@.</SourceNote>
    </div>
  );
}

function fmtMoney(v: number): string {
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return `₹${Math.round(v)}`;
}

// ============================ ONE-PAGER (print-ready slide) ============================

function OPHead({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>;
}

function OnePager({ m }: { m: Model }) {
  const painItems = PAIN.flatMap((g) => g.items);
  const painCounts = painItems.reduce((a, i) => ((a[i.cover] += 1), a), { full: 0, partial: 0, none: 0 } as Record<Cover, number>);
  const painSlices: Slice[] = (["full", "partial", "none"] as Cover[]).map((c) => ({ label: COVER_META[c].label, value: painCounts[c], color: COVER_META[c].color }));
  const desCounts = CHECKLIST.reduce((a, c) => ((a[c.v] += 1), a), { yes: 0, assumed: 0, no: 0 } as Record<Verdict, number>);
  const desSlices: Slice[] = (["yes", "assumed", "no"] as Verdict[]).map((v) => ({ label: VERDICT_META[v].label, value: desCounts[v], color: VERDICT_META[v].color }));
  const servicesSlices: Slice[] = [
    { label: "Property", value: Math.round(cr(m.servicesProperty)), color: "#6366f1" },
    { label: "TEV/LIE/DPR", value: Math.round(cr(m.servicesTev)), color: "#0ea5e9" },
  ];
  const ENT_REV = 3e7; // ₹3 cr illustrative near-term enterprise revenue
  const saasPct = (m.som / (m.som + ENT_REV)) * 100;

  return (
    <div id="market-onepager" className="overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* Header band */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 text-white" style={{ background: "linear-gradient(110deg,#0b1f3a 0%,#13315c 55%,#1d4ed8 130%)" }}>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-200">Market &amp; Strategy · India</div>
          <h2 className="mt-0.5 text-lg font-bold leading-tight">Valytica — Property Valuation &amp; Feasibility Market</h2>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full border border-emerald-400/50 bg-emerald-400/15 px-2 py-0.5 text-[9.5px] font-semibold text-emerald-100">✓ Pain validated</span>
          <span className="rounded-full border border-amber-400/50 bg-amber-400/15 px-2 py-0.5 text-[9.5px] font-semibold text-amber-100">⚠ Modeled</span>
        </div>
      </div>

      {/* TOP ROW: market opportunity | competitor positioning map */}
      <div className="grid gap-3 px-4 pt-3 lg:grid-cols-2">
        <div className="rounded-lg border p-3">
          <OPHead>Market opportunity</OPHead>
          <div className="grid grid-cols-3 gap-2">
            <OPStat label="Services" value={fmtCr(m.servicesTAM)} sub="₹/yr activity" />
            <OPStat label="Software TAM" value={fmtCr(m.softwareTAM)} sub="SaaS ceiling" tone="brand" />
            <OPStat label="SOM 3-yr" value={fmtCr(m.som)} sub="ARR target" tone="emerald" />
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-3">
            {/* funnel */}
            <div className="space-y-1.5">
              <MiniBar label="TAM" value={fmtCr(m.softwareTAM)} pct={100} color="#6366f1" />
              <MiniBar label="SAM" value={fmtCr(m.sam)} pct={SAM_FRAC * 100} color="#8b5cf6" />
              <MiniBar label="SOM" value={fmtCr(m.som)} pct={Math.min((m.som / m.softwareTAM) * 100, 100)} color="#10b981" />
            </div>
            {/* services split donut */}
            <div className="flex items-center justify-center gap-2">
              <Donut data={servicesSlices} size={74} thickness={11} center={<div className="text-center"><div className="text-[10px] font-bold leading-none">{fmtCr(m.servicesTAM)}</div><div className="text-[7px] text-muted-foreground">services</div></div>} />
              <div className="space-y-0.5">
                {servicesSlices.map((s) => (
                  <div key={s.label} className="flex items-center gap-1 text-[8px] text-muted-foreground">
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.label} <span className="font-semibold text-foreground">₹{s.value}cr</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* firms as number chips */}
          <div className="mt-2.5 grid grid-cols-4 gap-1.5">
            {[
              { k: "6,176", l: "IBBI valuers" },
              { k: "3,000+", l: "L&B valuers" },
              { k: "10k+", l: "empanelled" },
              { k: "100s", l: "TEV/LIE firms" },
            ].map((f) => (
              <div key={f.l} className="rounded-md bg-muted/50 px-1.5 py-1 text-center">
                <div className="text-[13px] font-bold leading-none">{f.k}</div>
                <div className="mt-0.5 text-[8px] leading-tight text-muted-foreground">{f.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border p-3">
          <OPHead>Competitive landscape</OPHead>
          <PositioningMatrix />
        </div>
      </div>

      {/* FDV — radial gauges chained */}
      <div className="px-4 pt-3">
        <div className="rounded-lg border p-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">FDV — fix a red, lift the next</span>
          <div className="mt-1.5 flex items-center justify-between gap-1.5">
            {FDV_CHAIN.map((n, i) => (
              <div key={n.key} className="flex flex-1 items-center justify-center gap-1.5">
                <div className="flex flex-col items-center">
                  <Gauge score={n.score} color={n.color} />
                  <div className="mt-0.5 text-[10px] font-semibold">{n.label}</div>
                  <div className="text-[8.5px] font-medium leading-tight" style={{ color: n.color }}>⚙ {n.leverShort}</div>
                </div>
                {i < FDV_CHAIN.length - 1 && <ArrowRight className="size-4 shrink-0 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BOTTOM ROW: pain | desirability | viability */}
      <div className="grid gap-3 px-4 pt-3 lg:grid-cols-3">
        {/* Pain — coverage donut + list */}
        <div className="rounded-lg border p-3">
          <OPHead>Pain points · validated</OPHead>
          <div className="flex items-center gap-2">
            <Donut data={painSlices} size={62} thickness={9} center={<div className="text-center"><div className="text-[11px] font-bold leading-none">{painCounts.full}/{painItems.length}</div><div className="text-[7px] text-muted-foreground">solved</div></div>} />
            <ul className="flex-1 space-y-0.5">
              {painItems.slice(0, 5).map((it) => (
                <li key={it.t} className="flex items-center gap-1 text-[9px] leading-tight">
                  <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: COVER_META[it.cover].color }} />
                  <span className="min-w-0 truncate">{shortPain(it.t)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Desirability — signals donut + value-capture bar */}
        <div className="rounded-lg border p-3">
          <OPHead>Desirability · value</OPHead>
          <div className="flex items-center gap-2">
            <Donut data={desSlices} size={62} thickness={9} center={<div className="text-center"><div className="text-[11px] font-bold leading-none">{desCounts.yes}/12</div><div className="text-[7px] text-muted-foreground">evidenced</div></div>} />
            <div className="flex-1">
              <div className="mb-0.5 flex items-baseline justify-between text-[8px] text-muted-foreground">
                <span>Value / report</span>
                <span className="font-bold text-foreground">{fmtMoney(m.valuePerReport)}</span>
              </div>
              <div className="relative h-5 w-full overflow-hidden rounded bg-emerald-500/15">
                <div className="absolute inset-y-0 left-0 flex items-center rounded bg-brand px-1 text-[8px] font-semibold text-white" style={{ width: `${Math.max(m.captureRatio * 100, 12)}%` }}>₹200</div>
              </div>
              <div className="mt-0.5 text-[8px] text-muted-foreground">capture <span className="font-bold text-brand">~{Math.round(m.captureRatio * 100)}%</span> → headroom</div>
            </div>
          </div>
        </div>

        {/* Viability — two engines + revenue-mix bar */}
        <div className="rounded-lg border p-3">
          <OPHead>Viability · two engines</OPHead>
          <div className="grid grid-cols-2 gap-1.5">
            {ENGINES.map((e, i) => (
              <div key={e.name} className="rounded-md border p-1.5 text-center" style={{ borderColor: `${e.color}44`, background: `${e.color}08` }}>
                <div className="text-[9px] font-semibold">{i === 0 ? "SaaS · land" : "Enterprise"}</div>
                <div className="text-[12px] font-bold leading-tight" style={{ color: e.color }}>{i === 0 ? "₹5.8 cr" : "₹20–60L"}</div>
                <div className="text-[7.5px] text-muted-foreground">{i === 0 ? "ARR / yr" : "per deal"}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[8px] text-muted-foreground">Near-term revenue mix (est.)</div>
          <div className="mt-0.5 flex h-4 w-full overflow-hidden rounded text-[8px] font-semibold text-white">
            <div className="flex items-center justify-center" style={{ width: `${saasPct}%`, background: "#1d4ed8" }}>SaaS</div>
            <div className="flex items-center justify-center" style={{ width: `${100 - saasPct}%`, background: "#10b981" }}>Ent.</div>
          </div>
          <div className="mt-1 text-[8px] text-muted-foreground">SaaS blocked on #119 · enterprise contract-billed</div>
        </div>
      </div>

      <div className="px-4 pb-3 pt-2.5 text-[8px] leading-snug text-muted-foreground">
        Sources: IBBI registry · RBI · IOV/RVOs · Sigmavalue, Resurgent, Sapient, MITCON, CRISIL/D&amp;B, global AVMs. Market figures modeled (#122); funnel uninstrumented (#123). IBBI governs valuation; TEV/LIE/DPR is bank-empanelled.
      </div>
    </div>
  );
}

function Gauge({ score, color }: { score: number; color: string }) {
  return (
    <Donut
      size={56}
      thickness={7}
      data={[
        { label: "", value: score, color },
        { label: "", value: Math.max(100 - score, 0.001), color: "transparent" },
      ]}
      center={<span className="text-[12px] font-bold" style={{ color }}>{score}</span>}
    />
  );
}

function MiniBar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-7 shrink-0 text-[9px] font-semibold text-muted-foreground">{label}</span>
      <div className="h-4 flex-1 overflow-hidden rounded bg-muted/60">
        <div className="h-full rounded" style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: color }} />
      </div>
      <span className="w-14 shrink-0 text-right text-[9.5px] font-bold tabular-nums">{value}</span>
    </div>
  );
}

/** 2×2 competitor positioning map: x = manual→AI, y = consumer→bank-grade. */
function PositioningMatrix() {
  return (
    <div className="pl-4 pt-1">
      <div className="relative aspect-[1.7/1] w-full rounded-md border bg-muted/20">
        {/* quadrant guides */}
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
        <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-border" />
        {/* white-space highlight (top-right) */}
        <div className="absolute right-0 top-0 h-1/2 w-1/2 rounded-tr-md bg-emerald-500/[0.07]" />
        <span className="absolute right-1.5 top-1 text-[7.5px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">white space</span>
        {/* dots */}
        {COMP_MAP.map((c) => (
          <div key={c.name} className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1" style={{ left: `${c.x}%`, top: `${c.y}%` }}>
            <span
              className={cn("shrink-0 rounded-full", c.star ? "size-3 ring-2 ring-brand/30" : "size-2")}
              style={{ backgroundColor: c.color }}
            />
            <span className={cn("whitespace-nowrap text-[8px] leading-none", c.star ? "font-bold text-foreground" : "text-muted-foreground")}>{c.name}</span>
          </div>
        ))}
      </div>
      {/* axis labels */}
      <div className="mt-0.5 flex justify-between text-[7.5px] text-muted-foreground">
        <span>Manual / services</span>
        <span>AI / software →</span>
      </div>
      <div className="mt-0.5 text-center text-[7.5px] text-muted-foreground">↑ Bank-grade &amp; defensible · ↓ consumer / generic</div>
    </div>
  );
}

function shortPain(t: string): string {
  const map: Record<string, string> = {
    "Manual document extraction (deeds, EC, tax, plans) — poor scans, regional languages": "Manual document extraction",
    "Cross-document inconsistencies (area, ownership chain)": "Cross-document conflicts",
    "Per-bank report formats (SBI, HDFC… each different)": "Per-bank report formats",
    "Maintenance, tracking & audit across high case volume": "Maintenance · tracking · audit",
    "Scarce / unreliable comparable sales data": "Scarce comparables data",
    "Inconsistent quality across panel valuers": "Inconsistent panel quality",
    "Inflated / fraudulent valuations": "Inflated / fraud valuations",
    "Slow valuation TAT delays disbursal": "Slow TAT delays disbursal",
    "No national comparable-transaction database": "No national comparables DB",
    "Circle (guideline) value vs market value divergence": "Circle vs market gap",
  };
  return map[t] ?? t;
}

function OPStat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "brand" | "emerald" }) {
  return (
    <div className={cn("rounded-md border p-2", tone === "brand" && "border-brand/30 bg-brand/5", tone === "emerald" && "border-emerald-500/30 bg-emerald-500/5")}>
      <div className="text-[8.5px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-bold leading-tight">{value}</div>
      <div className="text-[8.5px] text-muted-foreground">{sub}</div>
    </div>
  );
}
