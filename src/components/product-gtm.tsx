"use client";

import {
  ArrowRight,
  Banknote,
  Check,
  Clock,
  Handshake,
  Landmark,
  MessageCircle,
  Search,
  Target,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { VisionVariant } from "@/components/valytica-market-dashboard";

/**
 * Product Go-to-market — the marketing strategy layer (positioning, ICP,
 * competitive battlecards, channels). Config-driven per product variant,
 * infographic, scrolls. Lives under the Marketing tab.
 */

type GtmCfg = {
  tagline: string;
  positioning: string;
  valueProps: { icon: React.ComponentType<{ className?: string }>; title: string; detail: string }[];
  icp: { name: string; who: string; pains: string; reach: string; color: string }[];
  compMap: { name: string; x: number; y: number; color: string; star?: boolean }[];
  axis: { x: string; xEnd: string };
  battlecards: { rival: string; them: string; us: string }[];
  channels: { icon: React.ComponentType<{ className?: string }>; title: string; detail: string }[];
};

const VAL_GTM: GtmCfg = {
  tagline: "The fastest way to a bank-ready property valuation.",
  positioning:
    "For bank-empanelled valuers and lending teams who lose hours to manual reports, Valytica is an AI copilot that produces consistent, audit-ready valuations in minutes — unlike consumer price estimators (not defensible) or in-house bank tools (not built for valuers).",
  valueProps: [
    { icon: Clock, title: "Minutes, not days", detail: "AI drafts the report; the valuer reviews & signs" },
    { icon: Check, title: "Audit-ready", detail: "every value source-cited and defensible for banks" },
    { icon: Banknote, title: "₹200 a report", detail: "~90% margin — pays for itself on day one" },
  ],
  icp: [
    { name: "Bank-empanelled valuers", who: "individuals & small firms, high case volume", pains: "manual extraction · per-bank formats · month-end crunch", reach: "WhatsApp · valuer associations (IOV) · referrals", color: "#6366f1" },
    { name: "Lending ops (banks / NBFCs)", who: "retail & SME secured-lending teams", pains: "inconsistent panel quality · slow TAT · NPA risk", reach: "enterprise outreach · empanelment · pilots", color: "#0ea5e9" },
  ],
  compMap: [
    { name: "Valytica", x: 84, y: 16, color: "#1d4ed8", star: true },
    { name: "Banks' own AI", x: 72, y: 32, color: "#64748b" },
    { name: "Global estimators", x: 90, y: 54, color: "#94a3b8" },
    { name: "Sigmavalue", x: 62, y: 60, color: "#a855f7" },
    { name: "Housing / 99acres", x: 72, y: 86, color: "#94a3b8" },
  ],
  axis: { x: "By hand", xEnd: "By AI →" },
  battlecards: [
    { rival: "Sigmavalue", them: "broad AI valuation engine", us: "valuer copilot, human-in-loop, every bank's format" },
    { rival: "Banks' in-house AI", them: "captive, bank-built, slow to ship", us: "a product made for valuers, live today" },
    { rival: "Portal estimates (Housing/99acres)", them: "consumer ballpark prices", us: "bank-grade, audit-ready, defensible" },
  ],
  channels: [
    { icon: MessageCircle, title: "WhatsApp-first", detail: "free sample → wallet / plan" },
    { icon: Search, title: "Content & SEO", detail: "valuer guides, per-bank formats" },
    { icon: Users, title: "Associations", detail: "IOV / RVO partnerships" },
    { icon: Landmark, title: "Empanelment", detail: "bank pilots → panel rollout" },
  ],
};

const FEAS_GTM: GtmCfg = {
  tagline: "Bankable feasibility — TEV, LIE & DPR, without the wait.",
  positioning:
    "For advisory / engineering firms, bank project-finance teams, and project sponsors who need techno-economic and lender's-engineer reports, Atlas drafts bank-ready feasibility studies fast — unlike legacy consultancies that take weeks of manual work.",
  valueProps: [
    { icon: Clock, title: "Weeks → days", detail: "AI drafts; the engineer reviews & signs off" },
    { icon: Check, title: "Lender-ready", detail: "chaptered, grounded, in each lender's format" },
    { icon: Banknote, title: "₹2–50L per deal", detail: "high ACV, plus recurring LIE monitoring" },
  ],
  icp: [
    { name: "Advisory / engineering firms", who: "TEV/LIE/DPR consultancies (Atlas-type)", pains: "manual drafting · turnaround pressure · scale limits", reach: "empanelment · referrals · industry bodies", color: "#8b5cf6" },
    { name: "Banks · government · sponsors", who: "project-finance teams, PSUs, promoters", pains: "slow appraisals · inconsistent quality · monitoring load", reach: "RFP / tenders · relationships · pilots", color: "#0ea5e9" },
  ],
  compMap: [
    { name: "Atlas", x: 84, y: 16, color: "#1d4ed8", star: true },
    { name: "Resurgent", x: 30, y: 30, color: "#64748b" },
    { name: "Sapient", x: 26, y: 48, color: "#94a3b8" },
    { name: "MITCON / TCOs", x: 20, y: 66, color: "#94a3b8" },
    { name: "Banks' in-house", x: 70, y: 40, color: "#64748b" },
  ],
  axis: { x: "Manual / consulting", xEnd: "AI / product →" },
  battlecards: [
    { rival: "Resurgent / Sapient", them: "empanelled but manual, weeks per study", us: "AI-drafted, faster, same lender formats" },
    { rival: "Govt TCOs (MITCON)", them: "regional, capacity-bound", us: "scalable, consistent, on-demand" },
    { rival: "Banks' in-house", them: "limited project-finance bandwidth", us: "a product the bank can plug in" },
  ],
  channels: [
    { icon: Landmark, title: "Empanelment", detail: "get on bank panels (SBI, Canara…)" },
    { icon: Handshake, title: "RFP / tenders", detail: "government & PSU project pipelines" },
    { icon: Users, title: "Relationships", detail: "promoter & advisory referrals" },
    { icon: Search, title: "Thought leadership", detail: "sector reports, viability benchmarks" },
  ],
};

const GTM: Record<VisionVariant, GtmCfg> = { valuation: VAL_GTM, feasibility: FEAS_GTM };

function GtmSection({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
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

export function ProductGtm({ variant }: { variant: VisionVariant }) {
  const g = GTM[variant];
  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6">
      {/* Positioning */}
      <div className="overflow-hidden rounded-2xl text-white shadow-sm" style={{ background: "linear-gradient(115deg,#0b1f3a 0%,#13315c 52%,#1d4ed8 135%)" }}>
        <div className="px-7 py-7 sm:px-9 sm:py-9">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Go-to-market</div>
          <h1 className="mt-3 max-w-4xl text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{g.tagline}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-blue-100 sm:text-base">{g.positioning}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {g.valueProps.map((v) => (
              <div key={v.title} className="rounded-xl border border-white/15 bg-white/[0.07] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <v.icon className="size-4 text-blue-200" /> {v.title}
                </div>
                <div className="mt-1 text-sm text-blue-200">{v.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ICP */}
      <GtmSection title="Who we sell to" icon={Users}>
        <div className="grid gap-4 md:grid-cols-2">
          {g.icp.map((p) => (
            <div key={p.name} className="rounded-xl border bg-background p-5" style={{ borderColor: `${p.color}44` }}>
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full" style={{ backgroundColor: p.color }} />
                <h3 className="text-base font-semibold">{p.name}</h3>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{p.who}</div>
              <div className="mt-3 grid gap-2 text-sm">
                <div>
                  <span className="font-medium">Pains: </span>
                  <span className="text-muted-foreground">{p.pains}</span>
                </div>
                <div>
                  <span className="font-medium">Reach via: </span>
                  <span className="text-muted-foreground">{p.reach}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </GtmSection>

      {/* Competitive battlecards */}
      <GtmSection title="Competitive battlecards" icon={Target}>
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="relative h-64 w-full rounded-xl border bg-muted/20">
              <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
              <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-border" />
              <div className="absolute right-0 top-0 h-1/2 w-1/2 rounded-tr-xl bg-emerald-500/[0.08]" />
              <span className="absolute right-3 top-2 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                our space
              </span>
              {g.compMap.map((c) => (
                <div key={c.name} className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5" style={{ left: `${c.x}%`, top: `${c.y}%` }}>
                  <span className={cn("shrink-0 rounded-full", c.star ? "size-4 ring-4 ring-brand/20" : "size-2.5")} style={{ backgroundColor: c.color }} />
                  <span className={cn("whitespace-nowrap text-xs", c.star ? "font-bold text-foreground" : "text-muted-foreground")}>{c.name}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>{g.axis.x}</span>
              <span>{g.axis.xEnd}</span>
            </div>
            <div className="mt-1 text-center text-xs text-muted-foreground">↑ bank-grade · ↓ generic</div>
          </div>
          <div className="space-y-3">
            {g.battlecards.map((b) => (
              <div key={b.rival} className="rounded-xl border bg-background p-4">
                <div className="text-sm font-semibold">vs {b.rival}</div>
                <div className="mt-1.5 flex items-start gap-2 text-xs">
                  <span className="mt-0.5 rounded bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">them</span>
                  <span className="text-muted-foreground">{b.them}</span>
                </div>
                <div className="mt-1 flex items-start gap-2 text-xs">
                  <span className="mt-0.5 rounded bg-emerald-500/15 px-1.5 py-0.5 font-medium text-emerald-700 dark:text-emerald-400">us</span>
                  <span>{b.us}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </GtmSection>

      {/* Channels */}
      <GtmSection title="Channels & motion" icon={ArrowRight}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {g.channels.map((c) => (
            <div key={c.title} className="rounded-xl border bg-background p-4">
              <div className="mb-2 grid size-9 place-items-center rounded-lg bg-muted/70">
                <c.icon className="size-4 text-brand" />
              </div>
              <div className="text-sm font-semibold">{c.title}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{c.detail}</div>
            </div>
          ))}
        </div>
      </GtmSection>
    </div>
  );
}
