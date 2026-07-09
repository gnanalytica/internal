"use client";

import { useState } from "react";

import { applyStrategyOpAction } from "@/lib/strategy-actions";
import {
  PILLARS,
  pillarScore,
  signalIsStale,
  type Pillar,
  type Signal,
  type StrategyModel,
} from "@/lib/strategy";

import { InlineAdd, Ring, Section } from "./ui";

function Spark({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const pts = points
    .map((v, i) => `${2 + (i * 60) / (points.length - 1)},${24 - (v / 100) * 20}`)
    .join(" ");
  return (
    <svg width="64" height="26" viewBox="0 0 64 26" data-tip="score trend — direction matters more than the number">
      <polyline points={pts} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SignalRow({ signal, projectId }: { signal: Signal; projectId: string }) {
  const [open, setOpen] = useState(false);
  const stale = signalIsStale(signal);
  return (
    <div className="rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-muted/50">
      <div className="flex cursor-pointer items-start gap-2" onClick={() => setOpen((v) => !v)}>
        <button
          type="button"
          data-tip={signal.autoKey ? "auto-derived — recomputes from hub data" : "click to re-assess — the pillar score recomputes"}
          className={`mt-0.5 grid size-4 flex-none place-items-center rounded border text-[10px] font-extrabold transition-transform hover:scale-110 ${
            signal.ok
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-500"
              : "border-red-500/50 bg-red-500/10 text-red-500"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            if (!signal.autoKey) applyStrategyOpAction(projectId, { kind: "flipSignal", id: signal.id });
          }}
        >
          {signal.ok ? "✓" : "✕"}
        </button>
        <span className={signal.ok ? "" : "text-muted-foreground"}>{signal.claim}</span>
        <span className="ml-auto flex flex-none gap-1 self-center">
          {signal.stageId ? (
            <span className="s-chip text-[9px] text-violet-500" data-tip="the stage this signal de-risks">
              {signal.stageId}
            </span>
          ) : null}
          {signal.riskiest ? (
            <span className="s-chip text-[8px] font-bold text-red-500" data-tip="the fastest thesis-killer in this pillar">
              RISKIEST
            </span>
          ) : null}
          {signal.autoKey ? (
            <span className="rounded bg-sky-500 px-1 text-[9px] font-bold text-white">auto</span>
          ) : null}
          {stale ? (
            <span className="s-chip text-[9px] text-amber-500" data-tip="evidence older than 90 days — refresh it or it fades">
              stale
            </span>
          ) : null}
          {signal.source ? (
            signal.source.href ? (
              <a href={signal.source.href} className="s-chip text-[9px]" data-tip="source record — the underlying evidence" onClick={(e) => e.stopPropagation()}>
                {signal.source.label}
              </a>
            ) : (
              <span className="s-chip text-[9px]">{signal.source.label}</span>
            )
          ) : null}
          {!signal.ok ? (
            <button
              type="button"
              className="s-chip text-[9px] text-pink-500"
              data-tip="queue this gap as a Strategic Initiative"
              onClick={(e) => {
                e.stopPropagation();
                applyStrategyOpAction(projectId, {
                  kind: "upsertInitiative",
                  initiative: { id: crypto.randomUUID(), name: signal.claim, signalId: signal.id, stageId: signal.stageId },
                });
              }}
            >
              ✕ → initiative
            </button>
          ) : null}
        </span>
      </div>
      {open ? (
        <div className="mt-1 flex items-baseline gap-2 pl-6 text-[11px] text-muted-foreground">
          <span>{signal.why || "no reasoning recorded"}</span>
          <button
            type="button"
            className="s-chip ml-auto text-[9px]"
            onClick={() => applyStrategyOpAction(projectId, { kind: "setRiskiest", id: signal.id })}
          >
            mark riskiest
          </button>
          <button
            type="button"
            className="s-chip text-[9px] text-red-500"
            onClick={() => applyStrategyOpAction(projectId, { kind: "removeSignal", id: signal.id })}
          >
            remove
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PillarChart({
  pillar,
  milestones,
}: {
  pillar: Pillar;
  milestones: { id: string; name: string; total: number; closed: number }[];
}) {
  if (pillar === "feasibility" && milestones.length) {
    return (
      <div className="mt-2 border-t border-dashed pt-2">
        <span className="text-[8.5px] font-semibold uppercase tracking-widest text-muted-foreground">
          Capability burn-up · auto — Roadmap
        </span>
        <div className="mt-1.5 space-y-1.5">
          {milestones.slice(0, 4).map((m) => {
            const pct = m.total ? Math.round((m.closed / m.total) * 100) : 0;
            return (
              <div key={m.id} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="w-24 truncate">{m.name}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="s-grow h-full rounded-full bg-teal-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-8 text-right tabular-nums">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <div className="mt-2 border-t border-dashed pt-2 text-[10px] text-muted-foreground">
      {pillar === "desirability"
        ? "adoption funnel appears when Growth data is wired"
        : pillar === "viability"
          ? "finalize-rate trend appears when Analytics is wired"
          : "capability burn-up appears when milestones exist"}
    </div>
  );
}

export function FdvScorecard({
  model,
  projectId,
  milestones,
}: {
  model: StrategyModel;
  projectId: string;
  milestones: { id: string; name: string; total: number; closed: number }[];
}) {
  const historyFor = (p: Pillar) =>
    (model.scoreHistory ?? []).map((h) => (p === "desirability" ? h.d : p === "feasibility" ? h.f : h.v));
  return (
    <Section n={2} title="FDV Scorecard" sub="Desirability · Feasibility · Viability · score = ✓ ÷ signals">
      <div className="flex flex-wrap items-stretch gap-3">
        {PILLARS.map((p) => {
          const { score, ok, total } = pillarScore(model.signals, p.id);
          return (
            <div key={p.id} className="min-w-60 flex-1 rounded-lg border bg-background/40 p-3">
              <div className="mb-2 flex items-center gap-2.5">
                <Ring pct={score} label={`${p.label} score`} />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-widest">{p.label}</span>
                  <span className="text-[10px] text-muted-foreground">{p.question}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {ok} / {total} signals
                  </span>
                </div>
                <span className="ml-auto self-start">
                  <Spark points={historyFor(p.id)} />
                </span>
              </div>
              {model.signals
                .filter((s) => s.pillar === p.id)
                .map((s) => (
                  <SignalRow key={s.id} signal={s} projectId={projectId} />
                ))}
              <div className="mt-1.5">
                <InlineAdd
                  label="signal"
                  fields={[
                    { key: "claim", placeholder: "keyword claim" },
                    { key: "why", placeholder: "why · flip condition" },
                    { key: "source", placeholder: "source label" },
                  ]}
                  onAdd={(v) =>
                    v.claim &&
                    applyStrategyOpAction(projectId, {
                      kind: "upsertSignal",
                      signal: {
                        id: crypto.randomUUID(),
                        pillar: p.id,
                        claim: v.claim,
                        ok: false,
                        why: v.why || undefined,
                        source: v.source ? { label: v.source } : undefined,
                        date: new Date().toISOString().slice(0, 10),
                      },
                    })
                  }
                />
              </div>
              <PillarChart pillar={p.id} milestones={milestones} />
            </div>
          );
        })}
      </div>
    </Section>
  );
}
