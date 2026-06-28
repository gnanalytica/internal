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

// ---- market model (₹ crore / year) — modeled estimates anchored to public data ----
// Anchors: APAC property-valuation services market ~$1.9B (2024); residential
// ~75% of RE transactions; RBI / NaBFID project-finance scale; LIE is recurring.
// Exact per-segment splits still to be confirmed with primary data.
const MARKET_SEGMENTS: Slice[] = [
  { label: "Residential valuation", value: 1300, color: "#6366f1" },
  { label: "Commercial valuation", value: 800, color: "#0ea5e9" },
  { label: "Industrial / plant & machinery", value: 600, color: "#14b8a6" },
  { label: "Project reports (DPR) — MSME & projects", value: 1400, color: "#8b5cf6" },
  { label: "Techno-economic viability (TEV)", value: 450, color: "#f59e0b" },
  { label: "Lender's engineer (LIE) — incl. big projects", value: 400, color: "#ec4899" },
];
const marketTotal = MARKET_SEGMENTS.reduce((s, x) => s + x.value, 0); // ₹4,950 cr
const propertyTotal = 1300 + 800 + 600; // ₹2,700 cr
const feasibilityTotal = 1400 + 450 + 400; // ₹2,250 cr
const marketSAM = 1200; // ₹ cr — reachable (software + early enterprise), modeled
const market3yr = 18; // ₹ cr — 3-yr target (SaaS + first deals), modeled
const saasArr = 5.8; // ₹ cr — SaaS 3-yr ARR potential (for FDV)
const valuePerReport = 2000; // ₹ — value of time saved per report (modeled)

const inCr = (v: number) => `₹${v.toLocaleString("en-IN")} cr`;

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
    { label: "Total market", value: inCr(marketTotal), sub: "valuation + feasibility, per year", tone: "brand" },
    { label: "Property valuation", value: inCr(propertyTotal), sub: "residential · commercial · industrial" },
    { label: "Project feasibility", value: inCr(feasibilityTotal), sub: "TEV · LIE · DPR, incl. big projects" },
    { label: "We can reach", value: inCr(marketSAM), sub: "software + early enterprise", tone: "emerald" },
    { label: "3-year target", value: inCr(market3yr), sub: "SaaS + first deals" },
    { label: "Price per report", value: "₹200", sub: "~90% gross margin", tone: "brand" },
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
  const funnel: { l: string; v: number; pct: number; c: string }[] = [
    { l: "Whole market", v: marketTotal, pct: 100, c: "#6366f1" },
    { l: "We can reach", v: marketSAM, pct: (marketSAM / marketTotal) * 100, c: "#8b5cf6" },
    { l: "3-year target", v: market3yr, pct: (market3yr / marketTotal) * 100, c: "#10b981" },
  ];
  return (
    <Section title="The market, by type" icon={Building2}>
      {/* Pie of the market split + legend */}
      <div className="grid items-center gap-6 lg:grid-cols-[auto_1fr]">
        <div className="mx-auto">
          <Donut
            data={MARKET_SEGMENTS}
            size={210}
            thickness={36}
            center={
              <div className="text-center">
                <div className="text-2xl font-bold leading-none">{inCr(marketTotal)}</div>
                <div className="mt-1 text-xs text-muted-foreground">per year</div>
              </div>
            }
          />
        </div>
        <ul className="space-y-2.5">
          {MARKET_SEGMENTS.map((s) => (
            <li key={s.label} className="flex items-center gap-3 text-sm">
              <span className="size-3.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
              <span className="flex-1 text-foreground/90">{s.label}</span>
              <span className="shrink-0 font-bold tabular-nums">{inCr(s.value)}</span>
              <span className="w-10 shrink-0 text-right text-xs font-medium text-muted-foreground">
                {Math.round((s.value / marketTotal) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Modeled estimate of annual fees paid for these reports pan-India — anchored to the Asia-Pacific
        property-valuation market (~$1.9B, 2024, residential ~75% of transactions), RBI / NaBFID project-finance
        scale, and the large MSME DPR market (hundreds of thousands of project reports/yr at ₹35k–₹1.2L each).
        Exact splits to be confirmed.
      </p>

      {/* What we can realistically capture */}
      <div className="mt-6 space-y-3">
        {funnel.map((f) => (
          <div key={f.l} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-sm font-medium text-muted-foreground">{f.l}</span>
            <div className="h-8 flex-1 overflow-hidden rounded-lg bg-muted/60">
              <div className="h-full rounded-lg" style={{ width: `${Math.max(f.pct, 2)}%`, backgroundColor: f.c }} />
            </div>
            <span className="w-20 shrink-0 text-right text-base font-bold tabular-nums">{inCr(f.v)}</span>
          </div>
        ))}
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

// ============================ THE THREE BIG QUESTIONS (FDV) ============================

type FdvLens = { key: string; label: string; score: number; color: string; state: string; lever: string; unlocks: string };
const FDV_META: FdvLens[] = [
  { key: "F", label: "Feasibility", score: 80, color: "#10b981", state: "Shipped · proven unit economics", lever: "Migrate AI to India-based infrastructure", unlocks: "earns bank confidence" },
  { key: "D", label: "Desirability", score: 64, color: "#f59e0b", state: "Demand validated, not yet measured", lever: "Instrument usage & retention", unlocks: "validates real demand" },
  { key: "V", label: "Viability", score: 52, color: "#f59e0b", state: "Model defined, revenue unproven", lever: "Activate billing, land first accounts", unlocks: "proves the revenue model" },
];

function Fdv() {
  return (
    <Section title="Feasibility · Desirability · Viability — close the gaps in sequence" icon={Check}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <FdvCard n={FDV_META[0]}>
          <StatList
            rows={[
              { s: "ok", t: "Live across valuations & feasibility reports" },
              { s: "ok", t: "Reliable, source-checked AI output" },
              { s: "ok", t: "Gross profit per report", v: "₹180" },
              { s: "ok", t: "Unit cost per report", v: "₹20" },
              { s: "next", t: "India-based AI infrastructure" },
            ]}
          />
          <Bar label="Gross margin" right="~90%">
            <div className="h-3 w-full overflow-hidden rounded-full bg-emerald-500/15">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: "90%" }} />
            </div>
          </Bar>
        </FdvCard>

        <FdvArrow color={FDV_META[1].color} />

        <FdvCard n={FDV_META[1]}>
          <StatList
            rows={[
              { s: "ok", t: "Pain confirmed in user interviews" },
              { s: "ok", t: "Value delivered per report", v: `₹${valuePerReport.toLocaleString("en-IN")}` },
              { s: "ok", t: "Pricing headroom", v: "→ ₹400+" },
              { s: "next", t: "Measure usage & retention" },
              { s: "next", t: "Validate willingness to pay" },
            ]}
          />
          <Bar label="Pains addressed" right="4 of 6">
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
              { s: "ok", t: "Two revenue engines" },
              { s: "ok", t: "Subscription ARR potential", v: `₹${saasArr} cr` },
              { s: "ok", t: "Enterprise contract value", v: "₹20–60L" },
              { s: "next", t: "Activate recurring billing" },
              { s: "next", t: "Close first enterprise account" },
            ]}
          />
          <Bar label="Revenue mix" right="subscription · enterprise">
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
