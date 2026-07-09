"use client";

import { applyStrategyOpAction } from "@/lib/strategy-actions";
import { routeProgress, type Stage, type StrategyModel } from "@/lib/strategy";

import { Editable, InlineAdd, KpiChipView, Section } from "./ui";

const BADGE: Record<Stage["status"], { label: string; cls: string }> = {
  active: { label: "ACTIVE", cls: "bg-teal-500 text-white" },
  next: { label: "NEXT", cls: "border text-muted-foreground" },
  goal: { label: "GOAL", cls: "bg-amber-500 text-white" },
  done: { label: "DONE", cls: "bg-emerald-600 text-white" },
};

const ORDER: Stage["status"][] = ["active", "next", "goal", "done"];

const STAGE_COLORS = ["#14b8a6", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ec4899"];

/** Route: ascending line, one station per stage, flag at the end. */
function Route({ stages }: { stages: Stage[] }) {
  const n = stages.length;
  if (!n) return null;
  const pct = Math.round(routeProgress(stages) * 100);
  const x = (i: number) => 40 + (i * 890) / Math.max(1, n - 1 + 0.45);
  const y = (i: number) => 78 - (i * 58) / Math.max(1, n - 1 + 0.45);
  const d = `M 20 82 ${stages.map((_, i) => `L ${x(i)} ${y(i)}`).join(" ")} L 968 16`;
  const pts = [{ px: 20, py: 82 }, ...stages.map((_, i) => ({ px: x(i), py: y(i) })), { px: 968, py: 16 }];
  const t = (pct / 100) * (pts.length - 1);
  const seg = Math.min(pts.length - 2, Math.max(0, Math.floor(t)));
  const f = t - seg;
  const mx = pts[seg].px + (pts[seg + 1].px - pts[seg].px) * f;
  const my = pts[seg].py + (pts[seg + 1].py - pts[seg].py) * f;
  return (
    <svg viewBox="0 0 1000 96" className="my-1 w-full" preserveAspectRatio="none">
      <path d={d} fill="none" stroke="hsl(var(--border))" strokeWidth="4" strokeLinecap="round" pathLength={100} />
      <path
        d={d}
        fill="none"
        stroke="#14b8a6"
        strokeWidth="4"
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray={`${pct} ${100 - pct}`}
      />
      {stages.map((s, i) => (
        <circle
          key={s.id}
          cx={x(i)}
          cy={y(i)}
          r="8"
          fill="hsl(var(--card))"
          stroke={STAGE_COLORS[i % STAGE_COLORS.length]}
          strokeWidth="3"
          data-tip={`${s.label}${s.what ? ` — ${s.what}` : ""}`}
        />
      ))}
      <circle cx={mx} cy={my} r="12" fill="#14b8a6" opacity=".3">
        <animate attributeName="r" values="10;15;10" dur="2.4s" repeatCount="indefinite" />
      </circle>
      <circle cx={mx} cy={my} r="5.5" fill="#14b8a6" data-tip="you are here — derived from the active stage's KPIs vs their targets" />
      <text x={mx} y={my - 14} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#14b8a6" letterSpacing="2">
        YOU ARE HERE
      </text>
      <text x="968" y="38" textAnchor="middle" fontSize="15" data-tip="Destination — the vision">
        🏁
      </text>
    </svg>
  );
}

function StageCard({ stage, projectId }: { stage: Stage; projectId: string }) {
  const badge = BADGE[stage.status];
  const save = (patch: Partial<Stage>) =>
    applyStrategyOpAction(projectId, { kind: "upsertStage", stage: { ...stage, ...patch } });
  const row = "grid grid-cols-[42px_1fr] items-baseline gap-2 border-t border-dashed py-1.5 text-xs";
  const lbl = "text-[9px] font-extrabold tracking-widest text-muted-foreground";
  return (
    <div className="min-w-56 flex-1 rounded-lg border bg-background/40 p-3 transition-transform hover:-translate-y-0.5">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">
          <Editable value={stage.label} placeholder="Stage name" onSave={(v) => save({ label: v })} />
        </span>
        <button
          type="button"
          data-tip="click to change stage status"
          className={`ml-auto rounded px-1.5 py-0.5 text-[8.5px] font-extrabold tracking-widest ${badge.cls}`}
          onClick={() => save({ status: ORDER[(ORDER.indexOf(stage.status) + 1) % ORDER.length] })}
        >
          {badge.label}
        </button>
      </div>
      <div className={`${row} border-t-0`}>
        <span className={lbl}>WHAT</span>
        <Editable value={stage.what} placeholder="offer · motion · who" onSave={(v) => save({ what: v })} />
      </div>
      <div className={row}>
        <span className={lbl}>WHY</span>
        <Editable value={stage.why} placeholder="the job this stage does" onSave={(v) => save({ why: v })} />
      </div>
      <div className={row}>
        <span className={lbl}>KPI</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {stage.kpis.map((k) => (
            <KpiChipView key={k.name} kpi={k} />
          ))}
          <InlineAdd
            label="KPI"
            fields={[
              { key: "name", placeholder: "name" },
              { key: "current", placeholder: "current", type: "number" },
              { key: "target", placeholder: "target", type: "number" },
            ]}
            onAdd={(v) =>
              v.name &&
              save({
                kpis: [
                  ...stage.kpis,
                  {
                    name: v.name,
                    current: v.current === "" ? null : Number(v.current),
                    target: v.target === "" ? null : Number(v.target),
                  },
                ],
              })
            }
          />
        </div>
      </div>
      <div className={row}>
        <span className={lbl}>EXIT</span>
        <span className="text-sky-600 dark:text-sky-400" data-tip="the gate that unlocks the next stage">
          <Editable value={stage.exitCriteria} placeholder="gate to the next stage" onSave={(v) => save({ exitCriteria: v })} />
        </span>
      </div>
      <div className={row}>
        <span className={lbl}>KILL</span>
        <span className="text-red-500" data-tip="stop or pivot if this fires">
          <Editable value={stage.killCriteria} placeholder="stop / pivot trigger" onSave={(v) => save({ killCriteria: v })} />
        </span>
      </div>
    </div>
  );
}

export function PathToScale({ model, projectId }: { model: StrategyModel; projectId: string }) {
  const pains = model.problem?.pains ?? [];
  return (
    <Section n={1} title="Path to Scale" sub="today → destination · each stage carries its own kill criterion">
      <div className="flex flex-wrap items-baseline gap-3">
        <div className="text-[11.5px] text-muted-foreground" data-tip={model.problem?.whyNow || "edit the diagnosis in §6 Market Landscape"}>
          <span className="mr-1 text-[9px] font-extrabold tracking-widest text-red-500">PROBLEM</span>
          {pains.length ? pains.map((p) => p.label).join(" · ") : "define pains in §6"}
          {model.problem?.whyNow ? (
            <>
              <span className="mx-1.5 text-[9px] font-extrabold tracking-widest text-sky-500">WHY NOW</span>
              {model.problem.whyNow}
            </>
          ) : null}
        </div>
        <div className="ml-auto flex items-baseline gap-2 text-[13px]">
          <span className="text-[9px] font-extrabold tracking-widest text-amber-500">DESTINATION</span>
          <span aria-hidden>🏁</span>
          <Editable
            value={model.vision}
            placeholder="one-line vision"
            className="font-semibold"
            onSave={(v) => applyStrategyOpAction(projectId, { kind: "setVision", vision: v })}
          />
        </div>
      </div>
      <Route stages={model.stages} />
      <div className="flex flex-wrap items-stretch gap-3">
        {model.stages.map((s) => (
          <StageCard key={s.id} stage={s} projectId={projectId} />
        ))}
        <div className="self-center">
          <InlineAdd
            label="stage"
            fields={[{ key: "label", placeholder: "stage name" }]}
            onAdd={(v) =>
              v.label &&
              applyStrategyOpAction(projectId, {
                kind: "upsertStage",
                stage: {
                  id: crypto.randomUUID(),
                  label: v.label,
                  status: model.stages.length ? "next" : "active",
                  kpis: [],
                },
              })
            }
          />
        </div>
      </div>
    </Section>
  );
}
