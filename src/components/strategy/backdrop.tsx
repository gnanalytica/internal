"use client";

import { applyStrategyOpAction } from "@/lib/strategy-actions";
import type { StrategyModel } from "@/lib/strategy";

import { Editable, InlineAdd } from "./ui";

export function Backdrop({ model, projectId }: { model: StrategyModel; projectId: string }) {
  const market = model.market ?? {};
  const positioning = model.positioning ?? { dots: [] };
  const som =
    typeof market.sam === "number" && typeof market.capturePct === "number"
      ? Math.round(market.sam * (market.capturePct / 100))
      : null;
  const pains = model.problem?.pains ?? [];
  return (
    <details className="s-rise rounded-xl border border-dashed px-4">
      <summary className="cursor-pointer list-none py-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        <span className="mr-2 inline-grid size-6 place-items-center rounded-md bg-gradient-to-br from-teal-500 to-sky-500 align-middle text-xs font-extrabold text-white">
          6
        </span>
        Market Landscape &amp; Moat
        <span className="ml-2 text-[10.5px] font-normal normal-case tracking-normal">
          problem · TAM · SAM · SOM · positioning · strategic guardrails
        </span>
      </summary>
      <div className="flex flex-wrap gap-3.5 pb-4">
        <div className="min-w-64 flex-1 rounded-lg border bg-background/40 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Problem &amp; why now</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {pains.map((p, i) => (
              <button
                key={i}
                type="button"
                className="s-chip text-[10px] text-red-500"
                data-tip="click to remove"
                onClick={() =>
                  applyStrategyOpAction(projectId, {
                    kind: "setProblem",
                    problem: { pains: pains.filter((_, j) => j !== i), whyNow: model.problem?.whyNow },
                  })
                }
              >
                {p.label} ×
              </button>
            ))}
            <InlineAdd
              label="pain"
              fields={[{ key: "label", placeholder: "pain keyword" }]}
              onAdd={(v) =>
                v.label &&
                applyStrategyOpAction(projectId, {
                  kind: "setProblem",
                  problem: { pains: [...pains, { label: v.label }], whyNow: model.problem?.whyNow },
                })
              }
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            <span className="mr-1 text-[9px] font-extrabold tracking-widest text-sky-500">WHY NOW</span>
            <Editable
              value={model.problem?.whyNow}
              placeholder="what changed — the diagnosis"
              onSave={(v) => applyStrategyOpAction(projectId, { kind: "setProblem", problem: { pains, whyNow: v } })}
            />
          </p>
        </div>
        <div className="min-w-64 flex-1 rounded-lg border bg-background/40 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            TAM → SAM → SOM <span className="normal-case tracking-normal">(whole · reachable · ours)</span>
          </p>
          <div className="mt-2 space-y-1.5 text-[11px]">
            <p>
              <span className="text-muted-foreground">TAM: </span>
              <Editable value={market.tam} placeholder="whole market" onSave={(v) => applyStrategyOpAction(projectId, { kind: "setMarket", market: { ...market, tam: v } })} />
            </p>
            <p>
              <span className="text-muted-foreground">SAM: </span>
              <Editable value={market.sam != null ? String(market.sam) : undefined} placeholder="reachable (number)" onSave={(v) => applyStrategyOpAction(projectId, { kind: "setMarket", market: { ...market, sam: Number(v) || undefined } })} />
            </p>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">capture</span>
              <input
                type="range"
                min="1"
                max="50"
                defaultValue={market.capturePct ?? 10}
                className="flex-1"
                onMouseUp={(e) =>
                  applyStrategyOpAction(projectId, {
                    kind: "setMarket",
                    market: { ...market, capturePct: Number((e.target as HTMLInputElement).value) },
                  })
                }
              />
              <b className="tabular-nums">{market.capturePct ?? 10}%</b>
            </div>
            <p className="font-semibold text-teal-600 dark:text-teal-400 tabular-nums">SOM: {som ?? "—"}</p>
          </div>
        </div>
        <div className="min-w-64 flex-1 rounded-lg border bg-background/40 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Competitive positioning</p>
          <svg viewBox="0 0 300 170" className="mt-2 w-full">
            <rect x="30" y="8" width="262" height="130" rx="8" fill="none" stroke="hsl(var(--border))" />
            <line x1="161" y1="8" x2="161" y2="138" stroke="hsl(var(--border))" strokeDasharray="3 4" />
            <line x1="30" y1="73" x2="292" y2="73" stroke="hsl(var(--border))" strokeDasharray="3 4" />
            {positioning.dots.map((d, i) => (
              <g key={i}>
                <circle cx={30 + (d.x / 100) * 262} cy={138 - (d.y / 100) * 130} r={d.self ? 8 : 6} fill={d.self ? "#14b8a6" : "#64748b"} data-tip={d.label} />
                <text x={30 + (d.x / 100) * 262} y={138 - (d.y / 100) * 130 - 10} textAnchor="middle" fontSize="9" fill="currentColor" opacity=".7">
                  {d.label}
                </text>
              </g>
            ))}
            <text x="161" y="160" textAnchor="middle" fontSize="9" opacity=".6" fill="currentColor">
              {positioning.xLabel ?? "x axis"}
            </text>
          </svg>
          <InlineAdd
            label="dot"
            fields={[
              { key: "label", placeholder: "name" },
              { key: "x", placeholder: "x 0–100", type: "number" },
              { key: "y", placeholder: "y 0–100", type: "number" },
            ]}
            onAdd={(v) =>
              v.label &&
              applyStrategyOpAction(projectId, {
                kind: "setPositioning",
                positioning: {
                  ...positioning,
                  dots: [...positioning.dots, { label: v.label, x: Number(v.x) || 50, y: Number(v.y) || 50, self: positioning.dots.length === 0 }],
                },
              })
            }
          />
        </div>
        <div className="min-w-56 flex-[0.8] rounded-lg border bg-background/40 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Strategic guardrails <span className="normal-case tracking-normal">(ruled out on purpose)</span>
          </p>
          <div className="mt-2 space-y-1 text-[11.5px] text-muted-foreground">
            {(model.guardrails ?? []).map((g, i) => (
              <p key={i}>
                ✋ {g}{" "}
                <button
                  type="button"
                  className="text-[9px] text-red-500"
                  onClick={() =>
                    applyStrategyOpAction(projectId, {
                      kind: "setGuardrails",
                      guardrails: (model.guardrails ?? []).filter((_, j) => j !== i),
                    })
                  }
                >
                  ×
                </button>
              </p>
            ))}
          </div>
          <div className="mt-2">
            <InlineAdd
              label="guardrail"
              fields={[{ key: "label", placeholder: "not doing…" }]}
              onAdd={(v) =>
                v.label &&
                applyStrategyOpAction(projectId, {
                  kind: "setGuardrails",
                  guardrails: [...(model.guardrails ?? []), v.label],
                })
              }
            />
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">ruled out = strategy too</p>
        </div>
      </div>
    </details>
  );
}
