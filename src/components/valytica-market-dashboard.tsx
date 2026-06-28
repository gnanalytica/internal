"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Check, Maximize, Printer, Target, TrendingUp, Zap } from "lucide-react";

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
const INR_PER_USD = 83;
const TIME_SAVED = 0.5;
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

// ---- model, computed once ----
const bankVol = BASE.bankVolM * 1e6;
const servicesProperty = bankVol * BASE.avgFee;
const servicesTev = TEV_VOL * TEV_FEE;
const servicesTAM = servicesProperty + servicesTev;
const softwareTAM = bankVol * REPORT_SW + TEV_VOL * TEV_SW;
const sam = softwareTAM * SAM_FRAC;
const som = softwareTAM * (BASE.adoptPct / 100);
const valuePerReport = BASE.avgFee * TIME_SAVED;
const captureRatio = REPORT_SW / valuePerReport;

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
        className="relative w-full"
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
      <div className="mt-2.5 grid flex-1 grid-rows-[150px_236px_1fr] gap-2.5">
        {/* Row 1 */}
        <div className="grid grid-cols-3 gap-2.5">
          <Panel title="The arc — report → workflow → benchmark" icon={Target}>
            <Horizons />
          </Panel>
          <Panel title="Financial snapshot" icon={TrendingUp}>
            <Financials />
          </Panel>
          <Panel title="FDV — fix a red, lift the next" icon={Check}>
            <FDV />
          </Panel>
        </div>
        {/* Row 2 */}
        <div className="grid grid-cols-3 gap-2.5">
          <Panel title="Market opportunity" icon={Building2}>
            <Market />
          </Panel>
          <Panel title="Competitive landscape" icon={Target}>
            <Competition />
          </Panel>
          <Panel title="SWOT" icon={Zap}>
            <Swot />
          </Panel>
        </div>
        {/* Row 3 */}
        <div className="grid grid-cols-3 gap-2.5">
          <Panel title="Pain · validated">
            <Pain />
          </Panel>
          <Panel title="Desirability · value">
            <Desirability />
          </Panel>
          <Panel title="Viability · two engines">
            <Viability />
          </Panel>
        </div>
      </div>
      <p className="mt-2 shrink-0 text-[8.5px] leading-snug text-muted-foreground">
        Sources: IBBI registry · RBI · IOV/RVOs · Sigmavalue, Resurgent, Sapient, MITCON, CRISIL/D&amp;B, global AVMs.
        Pricing grounded in billing.ts; market figures modeled (#122); funnel uninstrumented (#123). IBBI governs
        valuation; TEV/LIE/DPR is a separate bank-empanelled consultant market.
      </p>
    </div>
  );
}

function Header() {
  const why = [
    { icon: TrendingUp, t: "Secured lending rising", s: "~231M retail loans/yr" },
    { icon: Building2, t: "Opinion layer thin & aging", s: "~6,176 IBBI valuers" },
    { icon: Zap, t: "AI crossed the line", s: "bank-ready, machine-drafted" },
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
          Make every valuation &amp; feasibility opinion <span className="font-semibold text-white">instant,
          consistent, and audit-defensible</span> — across property valuation and TEV / LIE / DPR.
        </p>
      </div>
      <div className="flex w-[300px] shrink-0 flex-col gap-1.5">
        <div className="flex items-center justify-end gap-1.5">
          <span className="rounded-full border border-emerald-400/50 bg-emerald-400/15 px-2 py-0.5 text-[9px] font-semibold text-emerald-100">
            ✓ Pain validated
          </span>
          <span className="rounded-full border border-amber-400/50 bg-amber-400/15 px-2 py-0.5 text-[9px] font-semibold text-amber-100">
            ⚠ Market modeled
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
    <div className="flex min-h-0 flex-col rounded-lg border bg-background p-2.5">
      <h3 className="mb-1.5 flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="size-3 text-brand" />}
        {title}
      </h3>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

// ============================ HORIZONS ============================

const HORIZONS: { h: string; title: string; when: string; color: string; proof: string }[] = [
  { h: "H1", title: "Win the report", when: "Now", color: "#1d4ed8", proof: "Shipped · ~90% margin/report" },
  { h: "H2", title: "Own the workflow", when: "12–24 mo", color: "#7c3aed", proof: "System of record · ship #119 + deals" },
  { h: "H3", title: "Become the benchmark", when: "24 mo+", color: "#10b981", proof: "Consistency intelligence · data moat" },
];

function Horizons() {
  return (
    <div className="flex h-full flex-col justify-between gap-1.5">
      {HORIZONS.map((z) => (
        <div
          key={z.h}
          className="flex items-center gap-2 rounded-md border px-2 py-1.5"
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
    { label: "Software TAM", value: fmtCr(softwareTAM), sub: fmtUsd(softwareTAM), tone: "brand" },
    { label: "SAM", value: fmtCr(sam), sub: `${SAM_FRAC * 100}% TAM` },
    { label: "SOM · 3-yr", value: fmtCr(som), sub: "ARR target", tone: "emerald" },
    { label: "Services mkt", value: fmtCr(servicesTAM), sub: "enterprise" },
    { label: "Price/report", value: "₹200", sub: "grounded", tone: "brand" },
    { label: "Gross margin", value: "~90%", sub: "₹200−₹20", tone: "emerald" },
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

const FDV_CHAIN: { key: string; label: string; score: number; color: string; state: string; lever: string }[] = [
  { key: "F", label: "Feasibility", score: 80, color: "#10b981", state: "Strong · built", lever: "India-region AI" },
  { key: "D", label: "Desirability", score: 64, color: "#f59e0b", state: "Pain validated", lever: "Instrument #123" },
  { key: "V", label: "Viability", score: 52, color: "#f59e0b", state: "Two engines", lever: "Ship #119 + deals" },
];

function FDV() {
  return (
    <div className="grid h-full grid-cols-3 gap-1.5">
      {FDV_CHAIN.map((n) => (
        <div key={n.key} className="flex flex-col items-center justify-between rounded-md border p-1.5 text-center">
          <Gauge score={n.score} color={n.color} />
          <div className="text-[11px] font-bold leading-none" style={{ color: n.color }}>
            {n.label}
          </div>
          <div className="text-[8px] leading-tight text-muted-foreground">{n.state}</div>
          <div className="rounded bg-muted/50 px-1 py-0.5 text-[8px] font-medium leading-tight" style={{ color: n.color }}>
            ⚙ {n.lever}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================ MARKET ============================

const FIRMS: { k: string; v: string }[] = [
  { k: "6,176", v: "IBBI valuers" },
  { k: "3,000+", v: "L&B valuers" },
  { k: "10k+", v: "empanelled" },
  { k: "100s", v: "TEV/LIE firms" },
];
const DEMAND: { k: string; v: string }[] = [
  { k: "231M", v: "retail loans/yr" },
  { k: "35%", v: "lending = proj. fin" },
  { k: "$1.18T", v: "RE by 2033" },
];

function Market() {
  const services: Slice[] = [
    { label: "Property", value: Math.round(cr(servicesProperty)), color: "#6366f1" },
    { label: "TEV/LIE/DPR", value: Math.round(cr(servicesTev)), color: "#0ea5e9" },
  ];
  const funnel: { l: string; v: number; pct: number; c: string }[] = [
    { l: "TAM", v: softwareTAM, pct: 100, c: "#6366f1" },
    { l: "SAM", v: sam, pct: SAM_FRAC * 100, c: "#8b5cf6" },
    { l: "SOM", v: som, pct: (som / softwareTAM) * 100, c: "#10b981" },
  ];
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="flex-1 space-y-1">
          {funnel.map((f) => (
            <div key={f.l} className="flex items-center gap-1.5">
              <span className="w-7 shrink-0 text-[9px] font-semibold text-muted-foreground">{f.l}</span>
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
  { name: "Bank AI", x: 74, y: 32, color: "#64748b" },
  { name: "Global AVMs", x: 90, y: 54, color: "#94a3b8" },
  { name: "Sigmavalue", x: 64, y: 60, color: "#6366f1" },
  { name: "Housing/99acres", x: 72, y: 86, color: "#94a3b8" },
  { name: "TEV/LIE firms", x: 22, y: 28, color: "#0ea5e9" },
  { name: "Big advisory", x: 16, y: 46, color: "#94a3b8" },
];

function Competition() {
  return (
    <div className="flex h-full flex-col gap-1">
      <div className="relative flex-1 rounded-md border bg-muted/20">
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
        <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-border" />
        <div className="absolute right-0 top-0 h-1/2 w-1/2 rounded-tr-md bg-emerald-500/[0.08]" />
        <span className="absolute right-1 top-0.5 text-[7px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
          white space
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
        <span>Manual / services</span>
        <span>AI / software →</span>
      </div>
      <div className="text-[8px] leading-tight text-muted-foreground">
        White space (top-right) = <span className="font-semibold text-foreground">AI · bank-grade · India · both
        markets</span>. No incumbent covers all four.
      </div>
    </div>
  );
}

// ============================ SWOT ============================

const SWOT: { key: string; title: string; color: string; items: string[] }[] = [
  { key: "S", title: "Strengths", color: "#10b981", items: ["Shipped: valuation + TEV/LIE/DPR", "~90% gross margin/report", "India-resident, bank-ready, grounded AI"] },
  { key: "W", title: "Weaknesses", color: "#f43f5e", items: ["Subscriptions not live (#119)", "Funnel uninstrumented (#123)", "Founder-led GTM; no sales motion"] },
  { key: "O", title: "Opportunities", color: "#1d4ed8", items: ["White space across both markets", "Enterprise co-own ₹20–60L ACV", "Comparables-DB gap = data moat"] },
  { key: "T", title: "Threats", color: "#f59e0b", items: ["Sigmavalue (closest AI)", "Captive bank in-house AI", "AI-trust in regulated deliverable"] },
];

function Swot() {
  return (
    <div className="grid h-full grid-cols-2 grid-rows-2 gap-1.5">
      {SWOT.map((q) => (
        <div key={q.key} className="min-h-0 rounded-md border p-1.5" style={{ borderColor: `${q.color}44` }}>
          <div className="mb-0.5 flex items-center gap-1">
            <span className="grid size-3.5 place-items-center rounded text-[8px] font-bold text-white" style={{ backgroundColor: q.color }}>
              {q.key}
            </span>
            <h4 className="text-[9.5px] font-semibold">{q.title}</h4>
          </div>
          <ul className="space-y-0.5">
            {q.items.map((it) => (
              <li key={it} className="flex items-start gap-1 text-[8px] leading-tight text-muted-foreground">
                <span className="mt-0.5 size-0.5 shrink-0 rounded-full" style={{ backgroundColor: q.color }} />
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ============================ PAIN / DESIRABILITY / VIABILITY ============================

type Cover = "full" | "partial" | "none";
const COVER_META: Record<Cover, { label: string; color: string }> = {
  full: { label: "Solves", color: "#10b981" },
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

function Pain() {
  const counts = PAIN.reduce((a, i) => ((a[i.cover] += 1), a), { full: 0, partial: 0, none: 0 } as Record<Cover, number>);
  const slices: Slice[] = (["full", "partial", "none"] as Cover[]).map((c) => ({ label: COVER_META[c].label, value: counts[c], color: COVER_META[c].color }));
  return (
    <div className="flex h-full items-center gap-2">
      <Donut
        data={slices}
        size={62}
        thickness={9}
        center={
          <div className="text-center">
            <div className="text-[11px] font-bold leading-none">{counts.full}/{PAIN.length}</div>
            <div className="text-[7px] text-muted-foreground">solved</div>
          </div>
        }
      />
      <ul className="flex-1 space-y-0.5">
        {PAIN.map((it) => (
          <li key={it.t} className="flex items-center gap-1 text-[9px] leading-tight">
            <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: COVER_META[it.cover].color }} />
            <span className="min-w-0 truncate">{it.t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Verdict = "yes" | "assumed" | "no";
const VERDICT_META: Record<Verdict, { color: string; label: string }> = {
  yes: { color: "#10b981", label: "Evidence" },
  assumed: { color: "#f59e0b", label: "Assumed" },
  no: { color: "#f43f5e", label: "Unvalidated" },
};
const DES_COUNTS: Record<Verdict, number> = { yes: 5, assumed: 3, no: 4 };

function Desirability() {
  const slices: Slice[] = (["yes", "assumed", "no"] as Verdict[]).map((v) => ({ label: VERDICT_META[v].label, value: DES_COUNTS[v], color: VERDICT_META[v].color }));
  return (
    <div className="flex h-full items-center gap-2">
      <Donut
        data={slices}
        size={62}
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
            style={{ width: `${Math.max(captureRatio * 100, 14)}%` }}
          >
            ₹200
          </div>
        </div>
        <div className="mt-0.5 text-[8px] text-muted-foreground">
          capture <span className="font-bold text-brand">~{Math.round(captureRatio * 100)}%</span> → headroom to grow price
        </div>
      </div>
    </div>
  );
}

const ENGINES: { short: string; headline: string; unit: string; color: string }[] = [
  { short: "SaaS · land", headline: "₹5.8 cr", unit: "ARR / yr (SOM)", color: "#1d4ed8" },
  { short: "Enterprise", headline: "₹20–60L", unit: "per deal (ACV)", color: "#10b981" },
];

function Viability() {
  const ENT_REV = 3e7;
  const saasPct = (som / (som + ENT_REV)) * 100;
  return (
    <div className="flex h-full flex-col gap-1.5">
      <div className="grid grid-cols-2 gap-1.5">
        {ENGINES.map((e) => (
          <div key={e.short} className="rounded-md border p-1.5 text-center" style={{ borderColor: `${e.color}44`, background: `${e.color}08` }}>
            <div className="text-[9px] font-semibold">{e.short}</div>
            <div className="text-[14px] font-bold leading-tight" style={{ color: e.color }}>
              {e.headline}
            </div>
            <div className="text-[7.5px] text-muted-foreground">{e.unit}</div>
          </div>
        ))}
      </div>
      <div className="text-[8px] text-muted-foreground">Near-term revenue mix (est.)</div>
      <div className="flex h-4 w-full overflow-hidden rounded text-[8px] font-semibold text-white">
        <div className="flex items-center justify-center" style={{ width: `${saasPct}%`, background: "#1d4ed8" }}>
          SaaS
        </div>
        <div className="flex items-center justify-center" style={{ width: `${100 - saasPct}%`, background: "#10b981" }}>
          Ent.
        </div>
      </div>
      <div className="text-[8px] leading-tight text-muted-foreground">
        Enterprise-led for revenue · SaaS as funnel · blocked on #119
      </div>
    </div>
  );
}

// ============================ shared ============================

function Gauge({ score, color }: { score: number; color: string }) {
  return (
    <Donut
      size={46}
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
