import * as Crypto from "expo-crypto";
import { Alert, Pressable, View } from "react-native";

import { Divider, Text } from "@/components/ui";
import { inr } from "@/lib/format";
import { useTheme } from "@/theme";

import type { Initiative, MilestoneProgress, StrategyView } from "../api";
import { Bar } from "../ui";
import type { Edit } from "./path-to-scale";
import { ProgressRow } from "./scorecard";
import { AddLink, Block, numOrNull, run, Tag, tap } from "./shared";

/** §3 — the top three open initiatives: gap → initiative → milestone. */
export function Initiatives({ projectId, view, milestones, edit }: { projectId: string; view: StrategyView; milestones: MilestoneProgress[]; edit: Edit }) {
  const open = view.model.initiatives.filter((i) => !i.done);
  const done = view.model.initiatives.filter((i) => i.done).length;
  return (
    <Block n={3} title="Strategic Initiatives" sub="top 3 · gap → initiative → milestone">
      {open.length === 0 ? <Text tone="muted">No initiatives yet. Queue one from a ✕ signal in the scorecard, or add one here.</Text> : null}
      {open.slice(0, 3).map((i) => (
        <InitiativeRow key={i.id} projectId={projectId} initiative={i} view={view} milestones={milestones} edit={edit} />
      ))}
      {open.length > 3 || done ? (
        <Text variant="small" tone="muted">
          {[open.length > 3 ? `${open.length - 3} more queued behind these` : null, done ? `${done} done` : null].filter(Boolean).join(" · ")}
        </Text>
      ) : null}
      <AddLink
        label="Add initiative"
        onPress={() =>
          edit({
            title: "New initiative",
            submitLabel: "Add",
            fields: [{ key: "name", label: "Initiative", kind: "text", required: true }],
            initial: { name: "" },
            submit: (v) => run(projectId, { op: "upsertInitiative", initiative: { id: Crypto.randomUUID(), name: String(v.name) } }),
          })
        }
      />
    </Block>
  );
}

function InitiativeRow({ projectId, initiative, view, milestones, edit }: { projectId: string; initiative: Initiative; view: StrategyView; milestones: MilestoneProgress[]; edit: Edit }) {
  const { space } = useTheme();
  const gap = view.model.signals.find((s) => s.id === initiative.signalId);
  const ms = milestones.find((m) => m.id === initiative.milestoneId);
  const pct = ms && ms.total ? ms.closed / ms.total : 0;
  const open = () =>
    edit({
      title: initiative.name,
      fields: [
        { key: "name", label: "Initiative", kind: "text", required: true },
        { key: "milestoneId", label: "Roadmap milestone", kind: "choice", options: milestones.map((m) => ({ value: m.id, label: m.name, subtitle: m.total ? `${m.closed}/${m.total} tasks done` : "no tasks yet" })), noneLabel: "Not linked", hint: "Its progress drives this bar." },
        { key: "done", label: "State", kind: "choice", options: [{ value: "open", label: "In progress" }, { value: "done", label: "Done" }] },
      ],
      initial: { name: initiative.name, milestoneId: initiative.milestoneId ?? null, done: initiative.done ? "done" : "open" },
      submit: (v) => run(projectId, { op: "upsertInitiative", initiative: { ...initiative, name: String(v.name), milestoneId: (v.milestoneId as string | null) ?? undefined, done: v.done === "done" || undefined } }),
      onDelete: () => run(projectId, { op: "removeInitiative", id: initiative.id }),
      deleteLabel: "Remove initiative",
    });
  return (
    <Pressable onPress={open} style={({ pressed }) => ({ gap: space.sm, opacity: pressed ? 0.7 : 1 })}>
      <Divider />
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
        {initiative.stageId ? <Tag label={initiative.stageId} color="#8b5cf6" /> : null}
        {gap ? <Tag label={`✕ ${gap.claim}`} color="#ef4444" /> : null}
      </View>
      <Text weight="700">{initiative.name}</Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text variant="small" tone={ms ? "brand" : "muted"}>
          {ms ? `◇ ${ms.name}` : "Tap to link a roadmap milestone"}
        </Text>
        <Text variant="small" tone="muted" mono>
          {Math.round(pct * 100)}%
        </Text>
      </View>
      <Bar value={pct} color="#14b8a6" />
    </Pressable>
  );
}

/** §4 — the north star and the proof inventory behind it. */
export function Traction({ projectId, view, edit }: { projectId: string; view: StrategyView; edit: Edit }) {
  const { space } = useTheme();
  const ns = view.model.northStar;
  const proof = view.model.proofMetrics ?? [];
  const editNorthStar = () =>
    edit({
      title: "North star",
      fields: [
        { key: "label", label: "Metric", kind: "text", required: true, placeholder: "e.g. Reports signed per week" },
        ...(ns?.autoKey ? [] : ([{ key: "current", label: "Current", kind: "number" }] as const)),
        { key: "target", label: "Target", kind: "number" },
      ],
      initial: { label: ns?.label ?? "", current: ns?.current ?? null, target: ns?.target ?? null },
      submit: (v) => run(projectId, { op: "setNorthStar", northStar: { ...ns, label: String(v.label), ...(ns?.autoKey ? {} : { current: numOrNull(v.current) }), target: numOrNull(v.target) } }),
    });
  const setProof = (next: typeof proof) => run(projectId, { op: "setProofMetrics", proofMetrics: next });
  return (
    <Block n={4} title="Traction & North Star" sub="proof inventory · leading indicators">
      <Pressable onPress={editNorthStar} style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 4, borderColor: view.northStarPct === null ? "#94a3b8" : "#14b8a6", alignItems: "center", justifyContent: "center" }}>
          <Text weight="800" mono variant="small">
            {view.northStarPct === null ? "—" : `${view.northStarPct}%`}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text weight="700" mono>
            {ns?.current ?? "—"} → {ns?.target ?? "target"}
          </Text>
          <Text variant="small" tone={ns?.label ? "muted" : "brand"}>
            {ns?.label || "Tap to set the north-star metric"}
          </Text>
          {ns?.autoKey ? <Tag label="auto" color="#0ea5e9" /> : null}
        </View>
      </Pressable>
      <Text variant="caption" tone="muted" weight="600" style={{ textTransform: "uppercase", letterSpacing: 0.6 }}>
        Proof inventory
      </Text>
      {proof.length === 0 ? <Text tone="muted">Nothing tracked yet.</Text> : null}
      {proof.map((m, idx) => (
        <Pressable
          key={`${m.label}-${idx}`}
          onPress={() =>
            edit({
              title: m.label,
              fields: [
                { key: "label", label: "Label", kind: "text", required: true },
                ...(m.autoKey ? [] : ([{ key: "current", label: "Current", kind: "number" }] as const)),
                { key: "target", label: "Target", kind: "number" },
              ],
              initial: { label: m.label, current: m.current ?? null, target: m.target ?? null },
              submit: (v) => setProof(proof.map((x, j) => (j === idx ? { ...x, label: String(v.label), ...(m.autoKey ? {} : { current: numOrNull(v.current) }), target: numOrNull(v.target) } : x))),
              onDelete: () => setProof(proof.filter((_, j) => j !== idx)),
              deleteLabel: "Remove metric",
            })
          }
        >
          <ProgressRow label={m.label} value={typeof m.current === "number" && typeof m.target === "number" && m.target > 0 ? m.current / m.target : 0} detail={`${m.current ?? "—"}${m.target != null ? ` / ${m.target}` : ""}`} />
        </Pressable>
      ))}
      <AddLink
        label="Add metric"
        onPress={() =>
          edit({
            title: "New proof metric",
            submitLabel: "Add",
            fields: [
              { key: "label", label: "Label", kind: "text", required: true },
              { key: "current", label: "Current", kind: "number" },
              { key: "target", label: "Target", kind: "number" },
            ],
            initial: { label: "", current: null, target: null },
            submit: (v) => setProof([...proof, { label: String(v.label), current: numOrNull(v.current), target: numOrNull(v.target) }]),
          })
        }
      />
    </Block>
  );
}

/** §5 — per-unit margins from the project's pricing model. Read-only here, as on the web. */
export function UnitEconomics({ view }: { view: StrategyView }) {
  const { space } = useTheme();
  const ue = view.unitEconomics;
  const ccy = ue.currency ?? "INR";
  return (
    <Block n={5} title="Unit Economics" sub="margin under stress · from the pricing model">
      {ue.segments.length === 0 ? <Text tone="muted">Set a pricing model on this project (on the web) to see margins here.</Text> : null}
      {ue.segments.map((s) =>
        s.marginPct === null ? (
          <Text key={s.id} variant="small" tone="muted">
            {s.label}: no per-unit price ({s.model}), so margin is worked out per deal.
          </Text>
        ) : (
          <View key={s.id} style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.sm }}>
              <Text variant="small" style={{ flex: 1 }}>
                {s.label} · {inr(s.price, ccy)}/{ue.unitLabel ?? "unit"} · cost {inr(s.cost, ccy)}
              </Text>
              <Text variant="small" weight="700" mono style={{ color: s.marginPct >= 75 ? "#14b8a6" : s.marginPct >= 50 ? "#f59e0b" : "#ef4444" }}>
                {s.heavyMarginPct !== null && s.heavyMarginPct !== s.marginPct ? `${s.marginPct}% → ${s.heavyMarginPct}%` : `${s.marginPct}%`}
              </Text>
            </View>
            <Bar value={(s.heavyMarginPct ?? s.marginPct) / 100} color="#14b8a6" />
          </View>
        ),
      )}
      {ue.segments.some((s) => s.heavyMarginPct !== null && s.heavyMarginPct !== s.marginPct) ? (
        <Text variant="caption" tone="muted">
          The second figure is the margin on a heavy-tail unit, at its worst-case cost.
        </Text>
      ) : null}
    </Block>
  );
}

/** §6 — the diagnosis, the market, positioning and what is ruled out. */
export function Backdrop({ projectId, view, edit }: { projectId: string; view: StrategyView; edit: Edit }) {
  const { space } = useTheme();
  const m = view.model;
  const pains = m.problem?.pains ?? [];
  const market = m.market ?? {};
  const positioning = m.positioning ?? { dots: [] };
  const guardrails = m.guardrails ?? [];
  const capture = market.capturePct ?? 10;
  const som = typeof market.sam === "number" ? Math.round(market.sam * (capture / 100)) : null;
  const confirm = (what: string, then: () => void) =>
    Alert.alert(`Remove “${what}”?`, undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: then },
    ]);

  return (
    <Block n={6} title="Market Landscape & Moat" sub="problem · TAM · SAM · SOM · positioning · guardrails">
      <Sub title="Problem & why now">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {pains.map((p, i) => (
            <Tag key={`${p.label}-${i}`} label={`${p.label}  ×`} color="#ef4444" onPress={() => confirm(p.label, () => tap(projectId, { op: "setProblem", problem: { pains: pains.filter((_, j) => j !== i), whyNow: m.problem?.whyNow } }))} />
          ))}
          <AddLink
            label="pain"
            onPress={() =>
              edit({
                title: "New pain",
                submitLabel: "Add",
                fields: [{ key: "label", label: "Pain keyword", kind: "text", required: true }],
                initial: { label: "" },
                submit: (v) => run(projectId, { op: "setProblem", problem: { pains: [...pains, { label: String(v.label) }], whyNow: m.problem?.whyNow } }),
              })
            }
          />
        </View>
        <Pressable
          onPress={() =>
            edit({ title: "Why now", fields: [{ key: "whyNow", label: "What changed — the diagnosis", kind: "multiline" }], initial: { whyNow: m.problem?.whyNow ?? null }, submit: (v) => run(projectId, { op: "setProblem", problem: { pains, whyNow: (v.whyNow as string | null) ?? undefined } }) })
          }
        >
          <Text variant="small" tone={m.problem?.whyNow ? "default" : "muted"}>
            <Text variant="caption" weight="800" style={{ color: "#0ea5e9", letterSpacing: 1.2 }}>
              WHY NOW{"  "}
            </Text>
            {m.problem?.whyNow || "Tap to write what changed"}
          </Text>
        </Pressable>
      </Sub>

      <Sub title="TAM → SAM → SOM">
        <Pressable
          onPress={() =>
            edit({
              title: "Market size",
              fields: [
                { key: "tam", label: "TAM — the whole market", kind: "text", placeholder: "e.g. ₹4,000 cr of valuations a year" },
                { key: "sam", label: "SAM — reachable (a number)", kind: "number" },
                { key: "capturePct", label: "Capture % of SAM (1–50)", kind: "number" },
              ],
              initial: { tam: market.tam ?? null, sam: market.sam ?? null, capturePct: market.capturePct ?? null },
              submit: (v) => {
                const cap = numOrNull(v.capturePct);
                return run(projectId, { op: "setMarket", market: { ...market, tam: (v.tam as string | null) ?? undefined, sam: numOrNull(v.sam) ?? undefined, capturePct: cap === null ? undefined : Math.min(50, Math.max(1, cap)) } });
              },
            })
          }
          style={{ gap: 4 }}
        >
          <Text variant="small">
            <Text variant="small" tone="muted">TAM </Text>
            {market.tam || "—"}
          </Text>
          <Text variant="small">
            <Text variant="small" tone="muted">SAM </Text>
            {market.sam != null ? market.sam.toLocaleString("en-IN") : "—"}
            <Text variant="small" tone="muted">{`  ·  capture ${capture}%`}</Text>
          </Text>
          <Text weight="700" mono style={{ color: "#14b8a6" }}>
            SOM {som != null ? som.toLocaleString("en-IN") : "—"}
          </Text>
        </Pressable>
      </Sub>

      <Sub title="Competitive positioning">
        <Pressable
          onPress={() =>
            edit({
              title: "Positioning axes",
              fields: [
                { key: "xLabel", label: "X axis", kind: "text" },
                { key: "yLabel", label: "Y axis", kind: "text" },
              ],
              initial: { xLabel: positioning.xLabel ?? null, yLabel: positioning.yLabel ?? null },
              submit: (v) => run(projectId, { op: "setPositioning", positioning: { ...positioning, xLabel: (v.xLabel as string | null) ?? undefined, yLabel: (v.yLabel as string | null) ?? undefined } }),
            })
          }
        >
          <Text variant="small" tone="muted">
            x: {positioning.xLabel || "set an axis"} · y: {positioning.yLabel || "set an axis"}
          </Text>
        </Pressable>
        <Plot dots={positioning.dots} />
        <AddLink
          label="competitor or us"
          onPress={() =>
            edit({
              title: "New dot",
              submitLabel: "Add",
              fields: [
                { key: "label", label: "Name", kind: "text", required: true },
                { key: "x", label: "X (0–100)", kind: "number" },
                { key: "y", label: "Y (0–100)", kind: "number" },
              ],
              initial: { label: "", x: 50, y: 50 },
              submit: (v) => {
                const clamp = (n: number | null) => Math.min(100, Math.max(0, n ?? 50));
                return run(projectId, { op: "setPositioning", positioning: { ...positioning, dots: [...positioning.dots, { label: String(v.label), x: clamp(numOrNull(v.x)), y: clamp(numOrNull(v.y)), self: positioning.dots.length === 0 }] } });
              },
            })
          }
        />
      </Sub>

      <Sub title="Strategic guardrails · ruled out on purpose">
        {guardrails.length === 0 ? <Text variant="small" tone="muted">Nothing ruled out yet.</Text> : null}
        {guardrails.map((g, i) => (
          <Pressable key={`${g}-${i}`} onPress={() => confirm(g, () => tap(projectId, { op: "setGuardrails", guardrails: guardrails.filter((_, j) => j !== i) }))} style={{ flexDirection: "row", gap: 6 }}>
            <Text variant="small">✋</Text>
            <Text variant="small" style={{ flex: 1 }}>
              {g}
            </Text>
            <Text variant="small" tone="danger">
              ×
            </Text>
          </Pressable>
        ))}
        <AddLink
          label="guardrail"
          onPress={() =>
            edit({
              title: "New guardrail",
              submitLabel: "Add",
              fields: [{ key: "label", label: "Not doing…", kind: "text", required: true }],
              initial: { label: "" },
              submit: (v) => run(projectId, { op: "setGuardrails", guardrails: [...guardrails, String(v.label)] }),
            })
          }
        />
      </Sub>
    </Block>
  );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  const { space } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <Divider />
      <Text variant="caption" tone="muted" weight="600" style={{ textTransform: "uppercase", letterSpacing: 0.6 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

/** A 2×2 positioning plot: 0–100 on each axis, us in teal. */
function Plot({ dots }: { dots: { label: string; x: number; y: number; self?: boolean }[] }) {
  const { c, radius } = useTheme();
  if (!dots.length) return null;
  return (
    <View style={{ height: 180, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, position: "relative", overflow: "hidden" }}>
      <View style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, backgroundColor: c.border }} />
      <View style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, backgroundColor: c.border }} />
      {dots.map((d, i) => (
        <View key={`${d.label}-${i}`} style={{ position: "absolute", left: `${Math.min(92, Math.max(2, d.x))}%`, bottom: `${Math.min(88, Math.max(2, d.y))}%`, alignItems: "flex-start" }}>
          <View style={{ width: d.self ? 14 : 10, height: d.self ? 14 : 10, borderRadius: 7, backgroundColor: d.self ? "#14b8a6" : "#64748b" }} />
          <Text variant="caption" tone={d.self ? "default" : "muted"} weight={d.self ? "700" : "400"} numberOfLines={1}>
            {d.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
