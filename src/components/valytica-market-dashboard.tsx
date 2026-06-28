"use client";

import { ArrowRight, Building2, Check, Circle, Landmark, Maximize, Printer, Rocket, Target, TrendingUp, Zap } from "lucide-react";

import { Donut, type Slice } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Product Vision — a spacious, readable, full-width strategy page that scrolls.
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

type Tile = { label: string; value: string; sub: string; tone?: "brand" | "emerald" };
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
    { label: "Valuation market", value: "₹3,000 cr", sub: "per year", tone: "brand" },
    { label: "Residential", value: "₹1,300 cr", sub: "high volume" },
    { label: "Commercial + industrial", value: "₹1,700 cr", sub: "higher fee" },
    { label: "We can reach", value: "₹650 cr", sub: "software + accounts", tone: "emerald" },
    { label: "3-year target", value: "₹6 cr", sub: "subscription ARR" },
    { label: "Reports / year", value: "~5M", sub: "bank valuations" },
    { label: "Registered valuers", value: "~6,176", sub: "10k+ bank-empanelled" },
    { label: "Avg valuation fee", value: "₹2.5–4k", sub: "per report" },
    { label: "Price per report", value: "₹200", sub: "what banks pay", tone: "brand" },
    { label: "AI cost / report", value: "₹20", sub: "at scale" },
    { label: "Gross profit / report", value: "₹180", sub: "~90% margin", tone: "emerald" },
    { label: "Value saved / report", value: "₹2,000", sub: "~50% of time" },
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
    { label: "Feasibility market", value: "₹4,500 cr", sub: "per year", tone: "brand" },
    { label: "Project reports (DPR)", value: "₹2,500 cr", sub: "MSME · govt · private" },
    { label: "Techno-economic (TEV)", value: "₹1,000 cr", sub: "bank term loans" },
    { label: "LIE / monitoring", value: "₹1,000 cr", sub: "recurring", tone: "emerald" },
    { label: "We can reach", value: "₹900 cr", sub: "early enterprise", tone: "emerald" },
    { label: "Deal value", value: "₹2–50L", sub: "per engagement", tone: "brand" },
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

// ============================ shell ============================

export function MarketVisionDashboard({ variant = "valuation" }: { variant?: VisionVariant }) {
  const cfg = CONFIGS[variant];

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
        <Hero cfg={cfg} />
        <Horizons cfg={cfg} />
        <Numbers cfg={cfg} />
        <Impact cfg={cfg} />
        <Market cfg={cfg} />
        <Fdv cfg={cfg} />
        <Swot cfg={cfg} />
        <p className="px-1 text-xs leading-relaxed text-muted-foreground">{cfg.footer}</p>
      </div>
    </div>
  );
}

// Back-compat alias (older imports).
export const ValyticaMarketDashboard = MarketVisionDashboard;

// ============================ HERO ============================

function Hero({ cfg }: { cfg: Cfg }) {
  return (
    <div className="overflow-hidden rounded-2xl text-white shadow-sm" style={{ background: "linear-gradient(115deg,#0b1f3a 0%,#13315c 52%,#1d4ed8 135%)" }}>
      <div className="px-7 py-7 sm:px-9 sm:py-9">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">{cfg.eyebrow}</div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-emerald-400/50 bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-100">
              {cfg.badgeOk}
            </span>
            <span className="rounded-full border border-amber-400/50 bg-amber-400/15 px-3 py-1 text-xs font-semibold text-amber-100">
              {cfg.badgeWarn}
            </span>
          </div>
        </div>

        <h1 className="mt-5 max-w-4xl text-3xl font-bold leading-tight tracking-tight sm:text-[2.5rem]">{cfg.title}</h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-blue-100 sm:text-lg">{cfg.subtitle}</p>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {cfg.why.map((w) => (
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

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
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

function Horizons({ cfg }: { cfg: Cfg }) {
  return (
    <Section title="How we grow, step by step" icon={Target}>
      <div className="grid gap-4 md:grid-cols-3">
        {cfg.horizons.map((z) => (
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

function Numbers({ cfg }: { cfg: Cfg }) {
  return (
    <Section title="The numbers" icon={TrendingUp}>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {cfg.numbers.map((t) => (
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

// ============================ IMPACT ============================

function Impact({ cfg }: { cfg: Cfg }) {
  const im = cfg.impact;
  if (!im) return null;
  return (
    <Section title="The impact — faster, cheaper, and it unlocks new volume" icon={Rocket}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {im.deltas.map((d) => (
          <div key={d.label} className="rounded-xl border bg-background p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{d.label}</div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{d.before}</span>
              <ArrowRight className="size-4 shrink-0 text-emerald-500" />
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{d.after}</span>
            </div>
            <div className="mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{d.gain}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-background p-5">
          <h3 className="mb-3 text-sm font-semibold">Why it matters</h3>
          <ul className="space-y-2">
            {im.whyItMatters.map((w) => {
              const [lead, ...rest] = w.split(" — ");
              return (
                <li key={w} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  <span>
                    <span className="font-medium">{lead}</span>
                    {rest.length > 0 && <span className="text-muted-foreground"> — {rest.join(" — ")}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] p-5">
          <h3 className="mb-3 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            What it unlocks — new market
          </h3>
          <ul className="space-y-2.5">
            {im.unlocks.map((u) => (
              <li key={u.title} className="flex items-start gap-2 text-sm">
                <Rocket className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                <span>
                  <span className="font-semibold">{u.title}</span>{" "}
                  <span className="text-muted-foreground">— {u.detail}</span>
                </span>
              </li>
            ))}
          </ul>
          {im.note && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{im.note}</p>}
        </div>
      </div>
    </Section>
  );
}

// ============================ MARKET ============================

function Market({ cfg }: { cfg: Cfg }) {
  const total = cfg.segments.reduce((s, x) => s + x.value, 0);
  return (
    <Section title="The market, by type" icon={Building2}>
      <div className="grid items-center gap-6 lg:grid-cols-[auto_1fr]">
        <div className="mx-auto">
          <Donut
            data={cfg.segments}
            size={210}
            thickness={36}
            center={
              <div className="text-center">
                <div className="text-2xl font-bold leading-none">{inCr(total)}</div>
                <div className="mt-1 text-xs text-muted-foreground">per year</div>
              </div>
            }
          />
        </div>
        <ul className="space-y-2.5">
          {cfg.segments.map((s) => (
            <li key={s.label} className="flex items-center gap-3 text-sm">
              <span className="size-3.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
              <span className="flex-1 text-foreground/90">{s.label}</span>
              <span className="shrink-0 font-bold tabular-nums">{inCr(s.value)}</span>
              <span className="w-10 shrink-0 text-right text-xs font-medium text-muted-foreground">
                {Math.round((s.value / total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{cfg.segmentsNote}</p>

      <div className="mt-6 space-y-3">
        {cfg.funnel.map((f) => (
          <div key={f.l} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-sm font-medium text-muted-foreground">{f.l}</span>
            <div className="h-8 flex-1 overflow-hidden rounded-lg bg-muted/60">
              <div className="h-full rounded-lg" style={{ width: `${Math.max((f.v / total) * 100, 2)}%`, backgroundColor: f.color }} />
            </div>
            <span className="w-20 shrink-0 text-right text-base font-bold tabular-nums">{inCr(f.v)}</span>
          </div>
        ))}
      </div>

      <h3 className="mb-2 mt-7 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Who commissions these reports
      </h3>
      <div className={cn("grid gap-3", cfg.buyers.length === 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-1 sm:grid-cols-3")}>
        {cfg.buyers.map((b) => {
          const btotal = cfg.buyers.reduce((s, x) => s + x.value, 0);
          return (
            <div key={b.label} className="rounded-xl border bg-background p-4 text-center" style={{ borderColor: `${b.color}40` }}>
              <div className="text-xl font-bold" style={{ color: b.color }}>{inCr(b.value)}</div>
              <div className="mt-1 text-sm leading-tight text-foreground/90">{b.label}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{Math.round((b.value / btotal) * 100)}%</div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ============================ FDV ============================

function Fdv({ cfg }: { cfg: Cfg }) {
  return (
    <Section title="Feasibility · Desirability · Viability — close the gaps in sequence" icon={Check}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        {cfg.fdv.map((n, i) => (
          <div key={n.label} className="flex flex-1 items-stretch gap-4">
            <FdvCard n={n} />
            {i < cfg.fdv.length - 1 && (
              <div className="hidden shrink-0 flex-col items-center justify-center self-center lg:flex">
                <ArrowRight className="size-6" style={{ color: cfg.fdv[i + 1].color }} />
                <span className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">leads to</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

function FdvCard({ n }: { n: FdvLens }) {
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
      <ul className="mt-4 flex-1 space-y-2">
        {n.rows.map((r) => {
          const ok = r.s === "ok";
          const Icon = ok ? Check : Circle;
          const color = ok ? "#10b981" : "#f59e0b";
          return (
            <li key={r.t} className="flex items-center gap-2 text-sm">
              <Icon className="size-4 shrink-0" style={{ color }} />
              <span className="min-w-0 flex-1 text-foreground/90">{r.t}</span>
              {r.v && <span className="shrink-0 font-bold tabular-nums" style={{ color }}>{r.v}</span>}
            </li>
          );
        })}
      </ul>
      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">{n.bar.label}</span>
          <span className="font-bold">{n.bar.right}</span>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/40">
          {n.bar.parts.map((p, i) => (
            <div key={i} style={{ width: `${p.pct}%`, background: p.color }} />
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-medium" style={{ color: n.color }}>
        <span className="rounded-lg bg-muted/60 px-2.5 py-1">Next: {n.lever}</span>
        <span className="inline-flex items-center gap-1">
          <ArrowRight className="size-3.5" /> {n.unlocks}
        </span>
      </div>
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

function Swot({ cfg }: { cfg: Cfg }) {
  return (
    <Section title="Where we stand — an honest look" icon={Zap}>
      <div className="grid gap-4 md:grid-cols-2">
        {cfg.swot.map((q) => (
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
