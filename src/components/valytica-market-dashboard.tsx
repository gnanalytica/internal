"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Minus, Printer, RotateCcw, TriangleAlert, X } from "lucide-react";

import { ChartCard, Donut, Legend, type Slice } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Valytica · Market & Strategy — an interactive strategy dashboard.
 *
 * Every market figure is a MODELED ESTIMATE driven by the sliders, not a
 * researched fact (see task #122). The product/pricing/GTM facts are grounded
 * in the real valytica repo. The conversion funnel is shown as uninstrumented
 * because only $pageview is tracked today (task #123) — no numbers are invented.
 */

// ---- model constants (grounded / fixed assumptions) ----
const TEV_VOL = 16_000; // TEV/LIE/DPR reports per year (assumption)
const TEV_FEE = 200_000; // ₹ avg fee per project report (assumption)
const REPORT_SW = 200; // ₹ per property report — grounded: REPORT_COST_INR
const TEV_SW = 10_000; // ₹ software value per project report (assumption)
const SAM_FRAC = 0.4; // reachable share of software TAM (assumption)
const INR_PER_USD = 83;

const DEFAULTS = { bankVolM: 4, avgFee: 4000, adoptPct: 6 };
const STORAGE_KEY = "valytica-market:v1";

// ---- formatting ----
const cr = (v: number) => v / 1e7;
function fmtCr(v: number): string {
  const c = cr(v);
  return `₹${c.toLocaleString("en-IN", { maximumFractionDigits: c < 100 ? 1 : 0 })} cr`;
}
const fmtUsd = (v: number) => `$${(v / INR_PER_USD / 1e6).toFixed(v / INR_PER_USD / 1e6 < 20 ? 1 : 0)}M`;

type Section = "sizing" | "pain" | "fdv" | "gtm";
const SECTIONS: { id: Section; label: string }[] = [
  { id: "sizing", label: "Market sizing" },
  { id: "pain", label: "Pain points" },
  { id: "fdv", label: "Desirability" },
  { id: "gtm", label: "Go-to-market" },
];

/**
 * Renders inside the Marketing tab as the "Market" sub-tab (Campaigns · Content
 * · Market). No Topbar of its own — the Marketing view supplies the page chrome.
 */
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

  const m = useMemo(() => {
    const bankVol = bankVolM * 1e6;
    const servicesProperty = bankVol * avgFee;
    const servicesTev = TEV_VOL * TEV_FEE;
    const servicesTAM = servicesProperty + servicesTev;
    const swProperty = bankVol * REPORT_SW;
    const swTev = TEV_VOL * TEV_SW;
    const softwareTAM = swProperty + swTev;
    const sam = softwareTAM * SAM_FRAC;
    const som = softwareTAM * (adoptPct / 100);
    // swing range on the dominant input (bank volume 2M..6M at current fee)
    const swingLo = 2e6 * avgFee + servicesTev;
    const swingHi = 6e6 * avgFee + servicesTev;
    return {
      bankVol,
      servicesProperty,
      servicesTev,
      servicesTAM,
      swProperty,
      swTev,
      softwareTAM,
      sam,
      som,
      swingLo,
      swingHi,
    };
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

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* View toggle: explore interactively, or the print-ready one-pager. */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
          {(["interactive", "onepager"] as const).map((md) => (
            <button
              key={md}
              onClick={() => setMode(md)}
              aria-pressed={mode === md}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                mode === md
                  ? "bg-background font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {md === "interactive" ? "Interactive" : "One-pager"}
            </button>
          ))}
        </div>
        {mode === "onepager" && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={printPager}>
            <Printer className="size-4" /> Print / PDF
          </Button>
        )}
      </div>

      {mode === "onepager" ? (
        <OnePager m={m} />
      ) : (
        <>
          {/* Hero */}
          <header className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">India property valuation &amp; feasibility-report market</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Sizing, pain points, desirability and go-to-market for Valytica — an AI valuation copilot for
                Indian valuers. Figures are a model you can adjust; market data is unverified.
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              Modeled estimates · verify (#122)
            </span>
          </header>

          {/* Section tabs */}
          <div className="mb-5 flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                aria-pressed={section === s.id}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  section === s.id
                    ? "bg-background font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {section === "sizing" && (
            <Sizing m={m} bankVolM={bankVolM} setBankVolM={setBankVolM} avgFee={avgFee} setAvgFee={setAvgFee} adoptPct={adoptPct} setAdoptPct={setAdoptPct} reset={reset} />
          )}
          {section === "pain" && <PainPoints />}
          {section === "fdv" && <Desirability />}
          {section === "gtm" && <GoToMarket />}
        </>
      )}
    </div>
  );
}

// ============================ SIZING ============================

type Model = {
  bankVol: number; servicesProperty: number; servicesTev: number; servicesTAM: number;
  swProperty: number; swTev: number; softwareTAM: number; sam: number; som: number;
  swingLo: number; swingHi: number;
};

function Sizing({
  m,
  bankVolM,
  setBankVolM,
  avgFee,
  setAvgFee,
  adoptPct,
  setAdoptPct,
  reset,
}: {
  m: Model;
  bankVolM: number;
  setBankVolM: (n: number) => void;
  avgFee: number;
  setAvgFee: (n: number) => void;
  adoptPct: number;
  setAdoptPct: (n: number) => void;
  reset: () => void;
}) {
  const servicesSlices: Slice[] = [
    { label: "Property valuation", value: Math.round(cr(m.servicesProperty)), color: "#6366f1" },
    { label: "TEV / LIE / DPR", value: Math.round(cr(m.servicesTev)), color: "#0ea5e9" },
  ];
  const softwareSlices: Slice[] = [
    { label: "Property (₹200/report)", value: Math.round(cr(m.swProperty)), color: "#8b5cf6" },
    { label: "Project reports", value: Math.round(cr(m.swTev)), color: "#10b981" },
  ];

  return (
    <div className="space-y-4">
      {/* Headline stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Services market / yr" value={fmtCr(m.servicesTAM)} sub={fmtUsd(m.servicesTAM)} tone="muted" hint="Fees valuers/consultants earn" />
        <StatCard label="Software TAM / yr" value={fmtCr(m.softwareTAM)} sub={fmtUsd(m.softwareTAM)} tone="brand" hint="Valytica's revenue ceiling" />
        <StatCard label="SOM · 3-yr ARR" value={fmtCr(m.som)} sub={`${adoptPct}% capture`} tone="emerald" hint="Realistic near-term target" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Funnel — signature */}
        <ChartCard title="Software opportunity" hint="TAM → SAM → SOM" className="lg:col-span-3">
          <div className="space-y-3 pt-1">
            <FunnelBar label="TAM — total software market" value={m.softwareTAM} pct={100} color="#6366f1" note="every report on a tool" />
            <FunnelBar label="SAM — reachable valuers/firms" value={m.sam} pct={SAM_FRAC * 100} color="#8b5cf6" note={`${SAM_FRAC * 100}% digitally adoptable`} />
            <FunnelBar label="SOM — 3-yr realistic capture" value={m.som} pct={adoptPct} color="#10b981" note={`${adoptPct}% of TAM`} />
          </div>
          <p className="mt-4 rounded-lg bg-muted/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            Swing on the dominant input (bank-valuation volume, 2M–6M/yr): services market ranges{" "}
            <span className="font-medium text-foreground">{fmtCr(m.swingLo)}–{fmtCr(m.swingHi)}</span>. Verify
            this and valuer adoption first — they move the answer most.
          </p>
          <p className="mt-2 rounded-lg border border-brand/20 bg-brand/5 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Two revenue engines.</span> SaaS captures the software
            TAM ({fmtCr(m.softwareTAM)} ceiling); the enterprise build / co-own arm addresses the far larger
            services market ({fmtCr(m.servicesTAM)}) per deal — sales-led, sized separately.
          </p>
        </ChartCard>

        {/* Assumptions */}
        <ChartCard title="Assumptions" hint="drag to model" className="lg:col-span-2">
          <div className="space-y-4 pt-1">
            <RangeRow label="Bank valuations / yr" value={`${bankVolM.toFixed(1)}M`} min={2} max={6} step={0.5} v={bankVolM} onChange={setBankVolM} confidence="low" />
            <RangeRow label="Avg fee / valuation" value={`₹${avgFee.toLocaleString("en-IN")}`} min={2500} max={6000} step={250} v={avgFee} onChange={setAvgFee} confidence="med" />
            <RangeRow label="3-yr capture (SOM)" value={`${adoptPct}%`} min={1} max={15} step={0.5} v={adoptPct} onChange={setAdoptPct} confidence="low" />
            <button onClick={reset} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <RotateCcw className="size-3.5" /> Reset to base case
            </button>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Fixed: TEV/LIE/DPR ≈ {TEV_VOL.toLocaleString("en-IN")}/yr @ ₹{(TEV_FEE / 1000).toFixed(0)}k; software ₹{REPORT_SW}/report (grounded) + ₹{(TEV_SW / 1000).toFixed(0)}k/project; SAM {SAM_FRAC * 100}%.
            </p>
          </div>
        </ChartCard>
      </div>

      {/* Segment breakdowns */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ChartCard title="Services market by segment" hint="₹ cr / yr">
          <div className="flex items-center gap-4">
            <Donut
              data={servicesSlices}
              center={<div><div className="text-sm font-bold">{fmtCr(m.servicesTAM)}</div><div className="text-[10px] text-muted-foreground">services</div></div>}
            />
            <Legend data={servicesSlices} className="flex-col !gap-1.5" />
          </div>
        </ChartCard>
        <ChartCard title="Software TAM by segment" hint="₹ cr / yr">
          <div className="flex items-center gap-4">
            <Donut
              data={softwareSlices}
              center={<div><div className="text-sm font-bold">{fmtCr(m.softwareTAM)}</div><div className="text-[10px] text-muted-foreground">software</div></div>}
            />
            <Legend data={softwareSlices} className="flex-col !gap-1.5" />
          </div>
        </ChartCard>
      </div>

      <SourceNote>
        Inputs to verify at: IBBI (registered-valuer counts), RBI (loan-origination &amp; project-finance volumes),
        RVOs (IOV / ICAI RVO / CVSRTA), plus 10–15 valuer interviews for fees &amp; willingness-to-pay.
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

function RangeRow({
  label, value, min, max, step, v, onChange, confidence,
}: {
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
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="w-full accent-[var(--brand)]"
      />
    </div>
  );
}

function StatCard({ label, value, sub, hint, tone }: { label: string; value: string; sub?: string; hint?: string; tone: "brand" | "emerald" | "muted" }) {
  const ring =
    tone === "brand" ? "border-brand/40 bg-brand/[0.06]" : tone === "emerald" ? "border-emerald-500/40 bg-emerald-500/[0.06]" : "";
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
      { t: "Site-visit logistics (geotag, photos, measurements)", impact: "Coordination + evidence overhead", cover: "full" },
      { t: "Tight turnaround + delisting risk for delays", impact: "Constant deadline pressure", cover: "full" },
      { t: "Scarce / unreliable comparable sales data", impact: "Circle-vs-market gap; relies on brokers/memory", cover: "partial" },
      { t: "IBBI compliance, liability, audit trail", impact: "Mistakes → delisting / legal exposure", cover: "full" },
      { t: "Low, standardized bank fees", impact: "Margin squeeze → must do volume", cover: "none" },
    ],
  },
  {
    group: "Bank (demand source)",
    accent: "#0ea5e9",
    items: [
      { t: "Inconsistent quality across panel valuers", impact: "Hard to trust / compare reports", cover: "partial" },
      { t: "Inflated / fraudulent valuations", impact: "Collateral shortfall → NPA losses", cover: "none" },
      { t: "Slow valuation TAT delays disbursal", impact: "Friction in loan processing", cover: "full" },
      { t: "RBI scrutiny on collateral valuation", impact: "Compliance & auditability burden", cover: "partial" },
    ],
  },
  {
    group: "Systemic (deep / unsolved)",
    accent: "#f43f5e",
    items: [
      { t: "No national comparable-transaction database", impact: "Root cause of valuation subjectivity", cover: "partial" },
      { t: "Circle (guideline) value vs market value divergence", impact: "Defensibility gap", cover: "none" },
      { t: "Manual title / encumbrance checks (portals, captchas)", impact: "Slow, no standard API", cover: "partial" },
    ],
  },
];

function PainPoints() {
  const counts = PAIN.flatMap((g) => g.items).reduce(
    (a, i) => ((a[i.cover] += 1), a),
    { full: 0, partial: 0, none: 0 } as Record<Cover, number>,
  );
  const slices: Slice[] = (["full", "partial", "none"] as Cover[]).map((c) => ({
    label: COVER_META[c].label,
    value: counts[c],
    color: COVER_META[c].color,
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Coverage" hint="of mapped pains" className="lg:col-span-1">
          <div className="flex items-center gap-4">
            <Donut data={slices} center={<div><div className="text-sm font-bold">{counts.full}/{slices.reduce((s, x) => s + x.value, 0)}</div><div className="text-[10px] text-muted-foreground">solved</div></div>} />
            <Legend data={slices} className="flex-col !gap-1.5" />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Valytica&apos;s wedge is the valuer&apos;s document-to-report grind. The deepest market gaps —
            comparables data &amp; bank-side fraud/QA — are only partly touched (the long-term moat).
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
      <SourceNote>Which pains valuers will pay to remove — and in what order — is the #122 interview question. This is the known problem map, not a ranked one.</SourceNote>
    </div>
  );
}

function CoverDot({ cover }: { cover: Cover }) {
  const meta = COVER_META[cover];
  return (
    <span
      className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full"
      style={{ backgroundColor: `${meta.color}22` }}
      title={meta.label}
    >
      {cover === "full" ? (
        <Check className="size-3" style={{ color: meta.color }} />
      ) : cover === "partial" ? (
        <Minus className="size-3" style={{ color: meta.color }} />
      ) : (
        <X className="size-3" style={{ color: meta.color }} />
      )}
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
  { q: "Target user (ICP) clearly defined", v: "assumed", note: "Sharper after interviews; still to formalize — #122" },
  { q: "Users will trust AI in a regulated deliverable", v: "assumed", note: "Architecture earns it; adoption at scale untested" },
  { q: "Reachable via a channel", v: "assumed", note: "WhatsApp + enterprise outreach; reply-rate unproven" },
  { q: "Users already seek a solution today", v: "no", note: "Status-quo / alternatives not yet mapped" },
  { q: "Evidence of demand (usage / retention)", v: "no", note: "Only $pageview tracked — #123" },
  { q: "Willingness-to-pay signals", v: "no", note: "Pain validated; pricing not yet tested — #119 / #124" },
  { q: "Referral / word-of-mouth potential", v: "no", note: "No NPS / feedback / referral instrumented" },
];

const LENSES: { label: string; score: number; tag: string; color: string }[] = [
  { label: "Feasibility", score: 80, tag: "Strong — built & shipped", color: "#10b981" },
  { label: "Desirability", score: 64, tag: "Pain validated by users; demand still unmeasured", color: "#f59e0b" },
  { label: "Viability", score: 52, tag: "Two engines — SaaS (subs blocked) + enterprise build/co-own", color: "#f59e0b" },
];

function Desirability() {
  const counts = CHECKLIST.reduce(
    (a, c) => ((a[c.v] += 1), a),
    { yes: 0, assumed: 0, no: 0 } as Record<Verdict, number>,
  );
  const slices: Slice[] = (["yes", "assumed", "no"] as Verdict[]).map((v) => ({
    label: VERDICT_META[v].label,
    value: counts[v],
    color: VERDICT_META[v].color,
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="FDV — three lenses" className="lg:col-span-2">
          <div className="space-y-3 pt-1">
            {LENSES.map((l) => (
              <div key={l.label}>
                <div className="mb-1 flex items-baseline justify-between text-xs">
                  <span className="font-medium">{l.label}</span>
                  <span className="text-muted-foreground">{l.tag}</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/60">
                  <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${l.score}%`, backgroundColor: l.color }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            Feasibility is built; the pain is now <span className="font-medium text-foreground">user-validated</span>.
            What&apos;s left is measuring demand (#123) and proving willingness-to-pay across the two revenue
            engines — SaaS self-serve and enterprise build / co-own.
          </p>
        </ChartCard>

        <ChartCard title="Desirability signals" hint="12 checks">
          <div className="flex items-center gap-4">
            <Donut data={slices} center={<div><div className="text-sm font-bold">{counts.yes}/12</div><div className="text-[10px] text-muted-foreground">evidenced</div></div>} />
            <Legend data={slices} className="flex-col !gap-1.5" />
          </div>
        </ChartCard>
      </div>

      <div className="rounded-xl border bg-background p-4">
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

      <SourceNote>
        User interviews confirm the pain — maintenance, cross-reference, tracking, audit, time &amp; volume.
        Next: instrument activation / retention (#123) and test willingness-to-pay across both the SaaS and
        enterprise paths.
      </SourceNote>
    </div>
  );
}

function VerdictBadge({ v }: { v: Verdict }) {
  const meta = VERDICT_META[v];
  return (
    <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full" style={{ backgroundColor: `${meta.color}22` }} title={meta.label}>
      {v === "yes" ? (
        <Check className="size-3" style={{ color: meta.color }} />
      ) : v === "assumed" ? (
        <TriangleAlert className="size-3" style={{ color: meta.color }} />
      ) : (
        <X className="size-3" style={{ color: meta.color }} />
      )}
    </span>
  );
}

// ============================ GO-TO-MARKET ============================

const TIERS: { name: string; price: string; note: string; popular?: boolean }[] = [
  { name: "Free", price: "₹0", note: "3 reports, watermarked" },
  { name: "Individual", price: "₹499/mo", note: "Unlimited, no watermark" },
  { name: "Team", price: "₹1,999/mo", note: "Firm, branding, analytics", popular: true },
  { name: "Business", price: "Custom", note: "Postpaid, API, support" },
];

const FUNNEL_STAGES = ["Signup", "First case", "First report", "Wallet recharge", "Plan upgrade"];

const BLOCKERS: { id: number; t: string; type: string; color: string; status: string }[] = [
  { id: 119, t: "Wire Razorpay plan subscriptions — revenue blocker", type: "engineering", color: "#5e6ad2", status: "todo" },
  { id: 120, t: "GST-compliant tax invoices", type: "finance", color: "#14b8a6", status: "backlog" },
  { id: 121, t: "Terms of Service, refund & privacy policy", type: "legal", color: "#ef4444", status: "backlog" },
  { id: 122, t: "Market sizing & competitive research", type: "research", color: "#0ea5e9", status: "backlog" },
  { id: 123, t: "Instrument PostHog funnel events", type: "product", color: "#8b5cf6", status: "todo" },
  { id: 124, t: "Confirm launch pricing & packaging", type: "product", color: "#8b5cf6", status: "backlog" },
  { id: 125, t: "Define enterprise sales motion + API scope", type: "sales", color: "#10b981", status: "backlog" },
];

function GoToMarket() {
  return (
    <div className="space-y-4">
      <ChartCard title="Business model — two engines" hint="land, then expand">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="grid size-5 place-items-center rounded-full bg-brand/15 text-brand">1</span>
              SaaS — self-serve
              <span className="rounded bg-brand/15 px-1.5 text-[9px] font-semibold uppercase text-brand">initial taste</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              Valuers sign up and run reports themselves — ₹200/report wallet + ₹499 / ₹1,999 plans. Proves
              value, gathers usage data, and seeds the comparables index. Recurring revenue is blocked until
              subscriptions ship (<span className="font-medium text-foreground">#119</span>).
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="grid size-5 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">2</span>
              Enterprise — custom build &amp; co-own
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              Build to a bank / firm&apos;s requirements, then co-own, hand over, or run as managed support.
              Sales-led, high-ACV; taps the services market and bills via contracts/invoices (not Razorpay) —
              needs GST (<span className="font-medium text-foreground">#120</span>) + ToS (<span className="font-medium text-foreground">#121</span>).
            </p>
          </div>
        </div>
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Pricing & packaging" hint="SaaS engine · grounded in billing.ts">
          <div className="grid grid-cols-2 gap-2">
            {TIERS.map((t) => (
              <div key={t.name} className={cn("rounded-lg border p-3", t.popular && "border-brand/50 bg-brand/[0.05]")}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{t.name}</span>
                  {t.popular && <span className="rounded bg-brand/15 px-1 text-[9px] font-semibold uppercase text-brand">Popular</span>}
                </div>
                <div className="mt-1 text-lg font-bold tabular-nums">{t.price}</div>
                <div className="text-[11px] text-muted-foreground">{t.note}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
            Pay-per-report: <span className="font-medium text-foreground">₹200</span> via prepaid wallet (live). Plan
            subscriptions are <span className="font-medium text-rose-500">stubbed</span> — paid revenue can&apos;t flow yet.
          </p>
        </ChartCard>

        <ChartCard title="Activation funnel" hint="not yet instrumented">
          <div className="space-y-1.5 pt-1">
            {FUNNEL_STAGES.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className="flex h-8 items-center rounded-md border border-dashed bg-muted/40 px-2 text-xs"
                  style={{ width: `${100 - i * 16}%` }}
                >
                  {s}
                </div>
                <span className="text-[11px] tabular-nums text-muted-foreground">?</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Only <code className="rounded bg-muted px-1">$pageview</code> is tracked today. Conversion is invisible until
            funnel events ship (#123) — no numbers invented here.
          </p>
        </ChartCard>
      </div>

      <div className="rounded-xl border bg-background p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Launch blockers &amp; cross-functional tasks</h3>
        <ul className="space-y-1.5">
          {BLOCKERS.map((b) => (
            <li key={b.id} className="flex items-center gap-2.5 rounded-md px-1 py-1 text-sm">
              <span className="font-mono text-[11px] text-muted-foreground">#{b.id}</span>
              <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ color: b.color, backgroundColor: `${b.color}1f` }}>
                {b.type}
              </span>
              <span className="min-w-0 flex-1 truncate">{b.t}</span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{b.status}</span>
            </li>
          ))}
        </ul>
      </div>

      <SourceNote>Motion: WhatsApp outreach → free sample report → wallet / paid plan. Enterprise → sales@. Tasks live under the &quot;GTM · WhatsApp Launch&quot; milestone.</SourceNote>
    </div>
  );
}

// ============================ ONE-PAGER (print-ready slide) ============================

function OPHead({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>
  );
}

function OPStat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "brand" | "emerald" }) {
  return (
    <div
      className={cn(
        "rounded-md border p-2",
        tone === "brand" && "border-brand/30 bg-brand/5",
        tone === "emerald" && "border-emerald-500/30 bg-emerald-500/5",
      )}
    >
      <div className="text-[8.5px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-bold leading-tight">{value}</div>
      <div className="text-[8.5px] text-muted-foreground">{sub}</div>
    </div>
  );
}

/** Compact, print-ready single-page version of the dashboard. Market numbers
 * track the live model `m` so the two views never drift. */
function OnePager({ m }: { m: Model }) {
  return (
    <div id="market-onepager" className="overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* Header band */}
      <div
        className="flex items-end justify-between gap-3 px-5 py-4 text-white"
        style={{ background: "linear-gradient(110deg,#0b1f3a 0%,#13315c 55%,#1d4ed8 130%)" }}
      >
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-200">Market &amp; Strategy · India</div>
          <h2 className="mt-1 text-xl font-bold leading-tight">Property Valuation &amp; Feasibility-Report Market</h2>
          <p className="mt-1 max-w-xl text-xs text-blue-100/90">Valytica — an AI valuation copilot for Indian valuers (Valuation · TEV · LIE · DPR).</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="rounded-full border border-emerald-400/50 bg-emerald-400/15 px-2 py-1 text-[10px] font-semibold text-emerald-100">✓ Pain validated with users</span>
          <span className="rounded-full border border-amber-400/50 bg-amber-400/15 px-2 py-1 text-[10px] font-semibold text-amber-100">⚠ Market figures modeled</span>
        </div>
      </div>

      {/* Body */}
      <div className="grid gap-3 p-4 md:grid-cols-3">
        {/* Market */}
        <div className="rounded-lg border p-3">
          <OPHead>Market opportunity</OPHead>
          <div className="grid grid-cols-3 gap-2">
            <OPStat label="Services" value={fmtCr(m.servicesTAM)} sub="activity" />
            <OPStat label="Software TAM" value={fmtCr(m.softwareTAM)} sub="SaaS ceiling" tone="brand" />
            <OPStat label="SOM 3-yr" value={fmtCr(m.som)} sub="ARR" tone="emerald" />
          </div>
          <div className="mt-3 space-y-2">
            <FunnelBar label="TAM software market" value={m.softwareTAM} pct={100} color="#6366f1" note="all reports" />
            <FunnelBar label="SAM reachable" value={m.sam} pct={40} color="#8b5cf6" note="40%" />
            <FunnelBar label="SOM 3-yr capture" value={m.som} pct={(m.som / m.softwareTAM) * 100} color="#10b981" note="" />
          </div>
          <p className="mt-2 rounded-md border border-brand/20 bg-brand/5 px-2 py-1.5 text-[10px] leading-snug text-muted-foreground">
            <span className="font-medium text-foreground">Two engines:</span> SaaS = software TAM ({fmtCr(m.softwareTAM)}); enterprise build / co-own taps services ({fmtCr(m.servicesTAM)}).
          </p>
        </div>

        {/* Pain */}
        <div className="rounded-lg border p-3">
          <OPHead>Pain points · user-validated</OPHead>
          <div className="space-y-2">
            {PAIN.map((g) => (
              <div key={g.group}>
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold">
                  <span className="size-2 rounded-full" style={{ backgroundColor: g.accent }} />
                  {g.group}
                </div>
                <ul className="space-y-1">
                  {g.items.slice(0, 3).map((it) => (
                    <li key={it.t} className="flex items-start gap-1.5 text-[10.5px] leading-snug">
                      <CoverDot cover={it.cover} />
                      <span className="min-w-0">{it.t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* FDV */}
        <div className="rounded-lg border p-3">
          <OPHead>Desirability · FDV</OPHead>
          <div className="space-y-2.5">
            {LENSES.map((l) => (
              <div key={l.label}>
                <div className="mb-1 flex items-baseline justify-between text-[11px]">
                  <span className="font-medium">{l.label}</span>
                  <span className="text-[9.5px] text-muted-foreground">{l.tag}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
                  <div className="h-full rounded-full" style={{ width: `${l.score}%`, backgroundColor: l.color }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 rounded-md px-2.5 py-2 text-[10px] leading-snug text-blue-50" style={{ backgroundColor: "#0b1f3a" }}>
            <span className="font-semibold text-white">Built; pain validated.</span> Two engines — SaaS (subs blocked #119) + enterprise build / co-own (contract-billed). Left: demand (#123) &amp; willingness-to-pay.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="grid gap-3 px-4 pb-3 md:grid-cols-2">
        <div className="rounded-lg border p-3">
          <OPHead>Pricing · SaaS engine</OPHead>
          <div className="flex flex-wrap gap-2">
            {TIERS.map((t) => (
              <div key={t.name} className={cn("rounded-md border px-2.5 py-1.5", t.popular && "border-brand/50 bg-brand/5")}>
                <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{t.name}</div>
                <div className="text-sm font-bold leading-tight">{t.price}</div>
                <div className="text-[9px] text-muted-foreground">{t.note}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            <span className="font-medium text-brand">₹200/report</span> wallet (live) · subscriptions blocked (#119) · enterprise = contract-billed
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <OPHead>Launch blockers &amp; tasks</OPHead>
          <div className="flex flex-wrap gap-1.5">
            {BLOCKERS.map((b) => (
              <span key={b.id} className="flex items-center gap-1.5 rounded-full border bg-muted/40 px-2 py-1 text-[10px]">
                <span className="font-mono text-[9px] text-muted-foreground">#{b.id}</span>
                <span className="rounded px-1 text-[8px] font-bold uppercase text-white" style={{ backgroundColor: b.color }}>{b.type}</span>
                <span className="max-w-[130px] truncate">{b.t}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 text-[9.5px] leading-snug text-muted-foreground">
        <span className="font-semibold">Sources / verify —</span> IBBI (valuer counts), RBI (loan &amp; project-finance volumes), RVOs (IOV / ICAI RVO / CVSRTA), plus valuer interviews. Software TAM = ₹200/report (grounded) + project reports; conversion funnel not yet instrumented — no numbers invented.
      </div>
    </div>
  );
}
