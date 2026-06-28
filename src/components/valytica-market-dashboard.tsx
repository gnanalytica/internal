"use client";

import { ArrowRight, Building2, Check, Circle, Maximize, Printer, Target, TrendingUp, Zap } from "lucide-react";

import { Donut, type Slice } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Valytica · CEO Vision — a spacious, readable, full-width strategy page that
 * scrolls: the north-star vision, why-now, the plan, the numbers, the market,
 * the competition, the three big questions (build / want / earn), and an honest
 * self-check. Plain language, large type, real charts. Full screen + Print/PDF.
 *
 * Grounding & honesty:
 * - Prices (₹200/report) are real (Valytica's billing).
 * - Market figures are estimates from a fixed base case (still to confirm).
 * - Valuation and feasibility reports are two related but separate markets.
 */

// ---- model constants ----
const TEV_VOL = 16_000;
const TEV_FEE = 200_000;
const REPORT_SW = 200; // ₹ per property report — real
const TEV_SW = 10_000;
const SAM_FRAC = 0.4;
const TIME_SAVED = 0.5;
const BASE = { bankVolM: 4, avgFee: 4000, adoptPct: 6 };

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

export function ValyticaMarketDashboard() {
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
    const el = document.getElementById("market-onepager") as
      | (HTMLElement & { webkitRequestFullscreen?: () => void })
      | null;
    if (!el) return;
    if (el.requestFullscreen) void el.requestFullscreen();
    else el.webkitRequestFullscreen?.();
  };

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <div className="mb-4 flex items-center justify-end gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={fullscreen}>
          <Maximize className="size-4" /> Full screen
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={printPage}>
          <Printer className="size-4" /> Print / PDF
        </Button>
      </div>

      <div id="market-onepager" className="space-y-6">
        <Hero />
        <Horizons />
        <Numbers />
        <Market />
        <Competition />
        <Fdv />
        <Swot />
        <p className="px-1 text-xs leading-relaxed text-muted-foreground">
          Prices are real. Market sizes are estimates we still need to confirm — based on public industry and
          government data plus competitor websites. Valuations and feasibility reports are two related but separate
          markets.
        </p>
      </div>
    </div>
  );
}

// ============================ HERO ============================

function Hero() {
  const why = [
    { icon: TrendingUp, t: "More loans every year", s: "231M loans a year in India" },
    { icon: Building2, t: "Too few valuers", s: "~6,176 registered valuers" },
    { icon: Zap, t: "AI is finally good enough", s: "bank-ready reports, fast" },
  ];
  return (
    <div className="overflow-hidden rounded-2xl text-white shadow-sm" style={{ background: "linear-gradient(115deg,#0b1f3a 0%,#13315c 52%,#1d4ed8 135%)" }}>
      <div className="px-7 py-7 sm:px-9 sm:py-9">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">
            Valytica · CEO Vision · India
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-emerald-400/50 bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-100">
              ✓ Problem confirmed
            </span>
            <span className="rounded-full border border-amber-400/50 bg-amber-400/15 px-3 py-1 text-xs font-semibold text-amber-100">
              ⚠ Market estimated
            </span>
          </div>
        </div>

        <h1 className="mt-5 max-w-4xl text-3xl font-bold leading-tight tracking-tight sm:text-[2.75rem]">
          Trust infrastructure for India&apos;s secured lending.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-blue-100 sm:text-lg">
          Make every property valuation and feasibility report{" "}
          <span className="font-semibold text-white">fast, consistent, and trustworthy</span> — for every bank loan.
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {why.map((w) => (
            <div key={w.t} className="rounded-xl border border-white/15 bg-white/[0.07] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <w.icon className="size-4 text-blue-200" /> {w.t}
              </div>
              <div className="mt-1 text-sm text-blue-200">{w.s}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================ section shell ============================

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-4 text-brand" />
        {title}
      </h2>
      {children}
    </section>
  );
}

// ============================ HORIZONS ============================

const HORIZONS: { n: string; title: string; when: string; color: string; proof: string }[] = [
  { n: "1", title: "Win the report", when: "Now", color: "#1d4ed8", proof: "Live now — ₹180 profit per report" },
  { n: "2", title: "Run the whole process", when: "1–2 years", color: "#7c3aed", proof: "Turn on subscriptions + win first deals" },
  { n: "3", title: "Set the standard", when: "2 years +", color: "#10b981", proof: "Build data no rival can copy" },
];

function Horizons() {
  return (
    <Section title="How we grow, step by step" icon={Target}>
      <div className="grid gap-4 md:grid-cols-3">
        {HORIZONS.map((z) => (
          <div key={z.n} className="rounded-xl border p-5" style={{ borderColor: `${z.color}40`, background: `${z.color}08` }}>
            <div className="flex items-center justify-between">
              <span className="grid size-8 place-items-center rounded-lg text-base font-bold text-white" style={{ backgroundColor: z.color }}>
                {z.n}
              </span>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{z.when}</span>
            </div>
            <div className="mt-3 text-lg font-semibold">{z.title}</div>
            <div className="mt-1 text-sm text-muted-foreground">{z.proof}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ============================ NUMBERS ============================

function Numbers() {
  const tiles: { label: string; value: string; sub: string; tone?: "brand" | "emerald" }[] = [
    { label: "Total market", value: fmtCr(softwareTAM), sub: "software, per year", tone: "brand" },
    { label: "We can reach", value: fmtCr(sam), sub: "realistically" },
    { label: "3-year target", value: fmtCr(som), sub: "per year", tone: "emerald" },
    { label: "Bigger services market", value: fmtCr(servicesTAM), sub: "custom builds" },
    { label: "Price per report", value: "₹200", sub: "what banks pay", tone: "brand" },
    { label: "Profit margin", value: "~90%", sub: "₹180 of ₹200", tone: "emerald" },
  ];
  return (
    <Section title="The numbers" icon={TrendingUp}>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <div
            key={t.label}
            className={cn(
              "rounded-xl border bg-background p-4",
              t.tone === "brand" && "border-brand/40 bg-brand/[0.06]",
              t.tone === "emerald" && "border-emerald-500/40 bg-emerald-500/[0.06]",
            )}
          >
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.label}</div>
            <div className="mt-1.5 text-2xl font-bold tabular-nums sm:text-3xl">{t.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{t.sub}</div>
          </div>
        ))}
      </div>
    </Section>
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
    { l: "Whole market", v: softwareTAM, pct: 100, c: "#6366f1" },
    { l: "We can reach", v: sam, pct: SAM_FRAC * 100, c: "#8b5cf6" },
    { l: "3-year target", v: som, pct: (som / softwareTAM) * 100, c: "#10b981" },
  ];
  return (
    <Section title="The opportunity" icon={Building2}>
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-3">
          {funnel.map((f) => (
            <div key={f.l} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-sm font-medium text-muted-foreground">{f.l}</span>
              <div className="h-8 flex-1 overflow-hidden rounded-lg bg-muted/60">
                <div className="h-full rounded-lg" style={{ width: `${Math.max(f.pct, 3)}%`, backgroundColor: f.c }} />
              </div>
              <span className="w-20 shrink-0 text-right text-base font-bold tabular-nums">{fmtCr(f.v)}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-5 rounded-xl border bg-background p-4">
          <Donut
            data={services}
            size={130}
            thickness={20}
            center={
              <div className="text-center">
                <div className="text-base font-bold leading-tight">{fmtCr(servicesTAM)}</div>
                <div className="text-xs text-muted-foreground">services market</div>
              </div>
            }
          />
          <div className="space-y-2">
            {services.map((s) => (
              <div key={s.label} className="text-sm">
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-muted-foreground">{s.label}</span>
                </div>
                <div className="ml-5 font-bold">₹{s.value} cr</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {FIRMS.map((f) => (
          <div key={f.v} className="rounded-xl bg-muted/50 p-4 text-center">
            <div className="text-2xl font-bold text-brand">{f.k}</div>
            <div className="mt-1 text-sm text-muted-foreground">{f.v}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {DEMAND.map((d) => (
          <div key={d.v} className="rounded-xl border bg-sky-500/5 p-4 text-center">
            <div className="text-xl font-bold text-sky-600 dark:text-sky-400">{d.k}</div>
            <div className="mt-1 text-sm text-muted-foreground">{d.v}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ============================ COMPETITION ============================

const COMP_MAP: { name: string; x: number; y: number; color: string; star?: boolean }[] = [
  { name: "Valytica", x: 84, y: 16, color: "#1d4ed8", star: true },
  { name: "Banks' own AI", x: 72, y: 32, color: "#64748b" },
  { name: "Global tools", x: 90, y: 54, color: "#94a3b8" },
  { name: "Sigmavalue", x: 62, y: 60, color: "#6366f1" },
  { name: "Housing / 99acres", x: 72, y: 86, color: "#94a3b8" },
  { name: "Feasibility firms", x: 22, y: 28, color: "#0ea5e9" },
  { name: "Big advisory firms", x: 16, y: 48, color: "#94a3b8" },
];

function Competition() {
  return (
    <Section title="Who else is out there" icon={Target}>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div>
          <div className="relative h-72 w-full rounded-xl border bg-muted/20">
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
            <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-border" />
            <div className="absolute right-0 top-0 h-1/2 w-1/2 rounded-tr-xl bg-emerald-500/[0.08]" />
            <span className="absolute right-3 top-2 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              the open gap
            </span>
            {COMP_MAP.map((c) => (
              <div
                key={c.name}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5"
                style={{ left: `${c.x}%`, top: `${c.y}%` }}
              >
                <span
                  className={cn("shrink-0 rounded-full", c.star ? "size-4 ring-4 ring-brand/20" : "size-2.5")}
                  style={{ backgroundColor: c.color }}
                />
                <span className={cn("whitespace-nowrap text-xs", c.star ? "font-bold text-foreground" : "text-muted-foreground")}>
                  {c.name}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>Done by hand</span>
            <span>Done by AI →</span>
          </div>
        </div>
        <div className="flex flex-col justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] p-5">
          <div className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            The open gap
          </div>
          <p className="mt-2 text-base leading-relaxed">
            The top-right corner is empty: a tool that&apos;s <span className="font-semibold">AI-powered,
            bank-ready, India-based, and does both jobs</span> — valuations and feasibility reports.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">No rival does all four. That&apos;s our space.</p>
        </div>
      </div>
    </Section>
  );
}

// ============================ THE THREE BIG QUESTIONS (FDV) ============================

type FdvLens = { key: string; label: string; score: number; color: string; state: string; lever: string; unlocks: string };
const FDV_META: FdvLens[] = [
  { key: "F", label: "Can we build it?", score: 80, color: "#10b981", state: "Yes — it's built", lever: "Move AI to India servers", unlocks: "banks trust us" },
  { key: "D", label: "Do they want it?", score: 64, color: "#f59e0b", state: "Problem confirmed", lever: "Measure real usage", unlocks: "proves they want it" },
  { key: "V", label: "Can we earn?", score: 52, color: "#f59e0b", state: "Two ways to earn", lever: "Launch + win first deals", unlocks: "proves the money" },
];

function Fdv() {
  return (
    <Section title="The three big questions — fix the gaps in order" icon={Check}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <FdvCard n={FDV_META[0]}>
          <StatList
            rows={[
              { s: "ok", t: "Built and live" },
              { s: "ok", t: "Accurate AI — no made-up facts" },
              { s: "ok", t: "Profit per report", v: "₹180" },
              { s: "ok", t: "Sells ₹200 · costs ₹20" },
              { s: "next", t: "Move AI to India servers" },
            ]}
          />
          <Bar label="Profit margin" right="~90%">
            <div className="h-3 w-full overflow-hidden rounded-full bg-emerald-500/15">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: "90%" }} />
            </div>
          </Bar>
        </FdvCard>

        <FdvArrow color={FDV_META[1].color} />

        <FdvCard n={FDV_META[1]}>
          <StatList
            rows={[
              { s: "ok", t: "Real problem, confirmed with users" },
              { s: "ok", t: "Saves per report", v: `₹${valuePerReport.toLocaleString("en-IN")}` },
              { s: "ok", t: "Room to raise the price", v: "→ ₹400+" },
              { s: "next", t: "Prove people keep using it" },
              { s: "next", t: "Find out what they'll pay" },
            ]}
          />
          <Bar label="Problems we solve" right="4 of 6">
            <div className="flex h-3 w-full overflow-hidden rounded-full">
              <div style={{ width: "67%", background: "#10b981" }} />
              <div style={{ width: "16%", background: "#f59e0b" }} />
              <div style={{ width: "17%", background: "#94a3b8" }} />
            </div>
          </Bar>
        </FdvCard>

        <FdvArrow color={FDV_META[2].color} />

        <FdvCard n={FDV_META[2]}>
          <StatList
            rows={[
              { s: "ok", t: "Two ways to earn money" },
              { s: "ok", t: "Subscriptions could reach", v: `${fmtCr(som)}/yr` },
              { s: "ok", t: "Each custom build", v: "₹20–60L" },
              { s: "next", t: "Switch on subscriptions" },
              { s: "next", t: "Win the first big customer" },
            ]}
          />
          <Bar label="Where revenue comes from" right="subscriptions · custom">
            <div className="flex h-3 w-full overflow-hidden rounded-full">
              <div style={{ width: "16%", background: "#1d4ed8" }} />
              <div style={{ width: "84%", background: "#10b981" }} />
            </div>
          </Bar>
        </FdvCard>
      </div>
    </Section>
  );
}

function FdvCard({ n, children }: { n: FdvLens; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col rounded-xl border p-5" style={{ borderColor: `${n.color}44`, background: `${n.color}07` }}>
      <div className="flex items-center gap-3">
        <Gauge score={n.score} color={n.color} />
        <div>
          <div className="text-lg font-bold leading-tight" style={{ color: n.color }}>
            {n.label}
          </div>
          <div className="text-sm text-muted-foreground">{n.state}</div>
        </div>
      </div>
      <div className="mt-4 flex-1 space-y-3">{children}</div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-medium" style={{ color: n.color }}>
        <span className="rounded-lg bg-muted/60 px-2.5 py-1">Next: {n.lever}</span>
        <span className="inline-flex items-center gap-1">
          <ArrowRight className="size-3.5" /> {n.unlocks}
        </span>
      </div>
    </div>
  );
}

function FdvArrow({ color }: { color: string }) {
  return (
    <div className="hidden shrink-0 flex-col items-center justify-center self-center lg:flex">
      <ArrowRight className="size-6" style={{ color }} />
      <span className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">leads to</span>
    </div>
  );
}

type Stat = "ok" | "next";
function StatList({ rows }: { rows: { s: Stat; t: string; v?: string }[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const ok = r.s === "ok";
        const Icon = ok ? Check : Circle;
        const color = ok ? "#10b981" : "#f59e0b";
        return (
          <li key={r.t} className="flex items-center gap-2 text-sm">
            <Icon className="size-4 shrink-0" style={{ color }} />
            <span className="min-w-0 flex-1 text-foreground/90">{r.t}</span>
            {r.v && (
              <span className="shrink-0 font-bold tabular-nums" style={{ color }}>
                {r.v}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Bar({ label, right, children }: { label: string; right: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-bold">{right}</span>
      </div>
      {children}
    </div>
  );
}

function Gauge({ score, color }: { score: number; color: string }) {
  return (
    <Donut
      size={64}
      thickness={8}
      data={[
        { label: "", value: score, color },
        { label: "", value: Math.max(100 - score, 0.001), color: "transparent" },
      ]}
      center={
        <span className="text-base font-bold" style={{ color }}>
          {score}
        </span>
      }
    />
  );
}

// ============================ SWOT ============================

const SWOT: { key: string; title: string; color: string; items: string[] }[] = [
  { key: "S", title: "Strengths", color: "#10b981", items: ["Built and live (both report types)", "High profit per report (~90% margin)", "India-based, bank-ready, accurate AI"] },
  { key: "W", title: "Weaknesses", color: "#f43f5e", items: ["Subscriptions not switched on yet", "Not tracking real usage yet", "No sales team yet"] },
  { key: "O", title: "Opportunities", color: "#1d4ed8", items: ["A big open gap in the market", "Large custom deals: ₹20–60 lakh each", "Can build data no one else has"] },
  { key: "T", title: "Threats", color: "#f59e0b", items: ["Sigmavalue (closest rival)", "Banks building their own AI", "Will banks trust AI reports?"] },
];

function Swot() {
  return (
    <Section title="Where we stand — an honest look" icon={Zap}>
      <div className="grid gap-4 md:grid-cols-2">
        {SWOT.map((q) => (
          <div key={q.key} className="rounded-xl border p-5" style={{ borderColor: `${q.color}40` }}>
            <div className="mb-3 flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg text-sm font-bold text-white" style={{ backgroundColor: q.color }}>
                {q.key}
              </span>
              <h3 className="text-base font-semibold">{q.title}</h3>
            </div>
            <ul className="space-y-2">
              {q.items.map((it) => (
                <li key={it} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ backgroundColor: q.color }} />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}
