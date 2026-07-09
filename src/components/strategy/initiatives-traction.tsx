"use client";

import { applyStrategyOpAction } from "@/lib/strategy-actions";
import type { Initiative, StrategyModel } from "@/lib/strategy";

import { Editable, HBar, InlineAdd, Ring, Section } from "./ui";

type MilestoneRow = { id: string; name: string; total: number; closed: number };

function InitiativeRow({
  initiative,
  model,
  projectId,
  milestones,
}: {
  initiative: Initiative;
  model: StrategyModel;
  projectId: string;
  milestones: MilestoneRow[];
}) {
  const gap = model.signals.find((s) => s.id === initiative.signalId);
  const ms = milestones.find((m) => m.id === initiative.milestoneId);
  const pct = ms && ms.total ? Math.round((ms.closed / ms.total) * 100) : 0;
  return (
    <div className="mt-2 rounded-lg border bg-background/40 p-3 transition-transform hover:translate-x-1">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {initiative.stageId ? (
          <span className="s-chip text-[9px] text-violet-500">{initiative.stageId}</span>
        ) : null}
        {gap ? (
          <span className="s-chip text-[10px] text-red-500" data-tip="the ✕ gap this initiative answers">
            ✕ {gap.claim}
          </span>
        ) : null}
        <span className="font-bold">{initiative.name}</span>
        {initiative.milestoneId ? (
          <a
            href={`#milestone-${initiative.milestoneId}`}
            className="s-chip text-[10px] text-sky-500"
            data-tip="Roadmap milestone driving this bar"
          >
            ◇ {ms?.name ?? "milestone"}
          </a>
        ) : (
          <select
            className="h-6 rounded-md border bg-transparent px-1 text-[10px]"
            defaultValue=""
            onChange={(e) =>
              e.target.value &&
              applyStrategyOpAction(projectId, {
                kind: "upsertInitiative",
                initiative: { ...initiative, milestoneId: e.target.value },
              })
            }
          >
            <option value="">link milestone…</option>
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">{pct}%</span>
        <button
          type="button"
          className="s-chip text-[9px] text-red-500"
          onClick={() => applyStrategyOpAction(projectId, { kind: "removeInitiative", id: initiative.id })}
        >
          remove
        </button>
      </div>
      <HBar pct={pct} className="mt-2" />
    </div>
  );
}

export function InitiativesTraction({
  model,
  projectId,
  milestones,
}: {
  model: StrategyModel;
  projectId: string;
  milestones: MilestoneRow[];
}) {
  const northStar = model.northStar;
  const nsPct =
    northStar && typeof northStar.current === "number" && typeof northStar.target === "number" && northStar.target > 0
      ? Math.min(100, Math.round((northStar.current / northStar.target) * 100))
      : null;
  return (
    <div className="grid gap-3.5 lg:grid-cols-[2fr_1fr]">
      <Section n={3} title="Strategic Initiatives" sub="top 3 · gap → initiative → milestone">
        {model.initiatives.filter((i) => !i.done).length === 0 ? (
          <p className="text-xs text-muted-foreground">
            no initiatives yet — queue one from a red ✕ in the scorecard, or add below
          </p>
        ) : null}
        {model.initiatives
          .filter((i) => !i.done)
          .slice(0, 3)
          .map((i) => (
            <InitiativeRow key={i.id} initiative={i} model={model} projectId={projectId} milestones={milestones} />
          ))}
        <div className="mt-2">
          <InlineAdd
            label="initiative"
            fields={[{ key: "name", placeholder: "initiative name" }]}
            onAdd={(v) =>
              v.name &&
              applyStrategyOpAction(projectId, {
                kind: "upsertInitiative",
                initiative: { id: crypto.randomUUID(), name: v.name },
              })
            }
          />
        </div>
      </Section>
      <Section n={4} title="Traction & North Star" sub="proof inventory · leading indicators">
        <div className="flex items-center gap-3">
          <Ring pct={nsPct} label="north star progress" />
          <div className="flex flex-col text-xs">
            <span className="font-semibold tabular-nums">
              {northStar?.current ?? "—"} →{" "}
              <Editable
                value={northStar?.target != null ? String(northStar.target) : undefined}
                placeholder="target"
                onSave={(v) =>
                  applyStrategyOpAction(projectId, {
                    kind: "setNorthStar",
                    northStar: { label: northStar?.label ?? "north star", ...northStar, target: Number(v) || null },
                  })
                }
              />
            </span>
            <Editable
              value={northStar?.label}
              placeholder="north star metric"
              className="text-[10px] text-muted-foreground"
              onSave={(v) =>
                applyStrategyOpAction(projectId, {
                  kind: "setNorthStar",
                  northStar: { ...northStar, label: v },
                })
              }
            />
          </div>
        </div>
        <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Proof inventory
        </p>
        {(model.proofMetrics ?? []).map((m, idx) => {
          const pct =
            typeof m.current === "number" && typeof m.target === "number" && m.target > 0
              ? Math.round((m.current / m.target) * 100)
              : 0;
          return (
            <div key={idx} className="mt-1.5">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>{m.label}</span>
                <span className="tabular-nums">
                  {m.current ?? "—"}
                  {m.target != null ? ` / ${m.target}` : ""}
                </span>
              </div>
              <HBar pct={pct} className="mt-1" />
            </div>
          );
        })}
        <div className="mt-2">
          <InlineAdd
            label="metric"
            fields={[
              { key: "label", placeholder: "label" },
              { key: "current", placeholder: "current", type: "number" },
              { key: "target", placeholder: "target", type: "number" },
            ]}
            onAdd={(v) =>
              v.label &&
              applyStrategyOpAction(projectId, {
                kind: "setProofMetrics",
                proofMetrics: [
                  ...(model.proofMetrics ?? []),
                  {
                    label: v.label,
                    current: v.current === "" ? null : Number(v.current),
                    target: v.target === "" ? null : Number(v.target),
                  },
                ],
              })
            }
          />
        </div>
      </Section>
    </div>
  );
}
