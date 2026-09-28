import * as Crypto from "expo-crypto";
import { Pressable, View } from "react-native";

import { Divider, Text } from "@/components/ui";
import { useTheme } from "@/theme";

import type { Stage, StageKpi, StrategyView } from "../api";
import type { FieldSpec, FormValues } from "../form-sheet";
import { Bar } from "../ui";
import { AddLink, Block, KPI_COLOR, Labelled, numOrNull, run, STAGE_ORDER, STAGE_STATUS, Tag, tap } from "./shared";

export type SheetSpec = { title: string; fields: FieldSpec[]; initial: FormValues; submitLabel?: string; submit: (v: FormValues) => Promise<void>; onDelete?: () => Promise<void>; deleteLabel?: string };
export type Edit = (spec: SheetSpec) => void;

const STATUS_OPTIONS = STAGE_ORDER.map((s) => ({ value: s, label: STAGE_STATUS[s].label, color: STAGE_STATUS[s].color }));

/** §1 — the route from today to the vision, one card per stage. */
export function PathToScale({ projectId, view, edit }: { projectId: string; view: StrategyView; edit: Edit }) {
  const { space } = useTheme();
  const m = view.model;
  const pains = m.problem?.pains ?? [];
  const pct = Math.round(view.routeProgress * 100);
  return (
    <Block n={1} title="Path to Scale" sub="today → destination · each stage carries its own kill criterion">
      <Labelled
        label="DESTINATION"
        color="#f59e0b"
        onPress={() => edit({ title: "Vision", fields: [{ key: "vision", label: "One-line vision", kind: "multiline" }], initial: { vision: m.vision ?? "" }, submit: (v) => run(projectId, { op: "setVision", vision: (v.vision as string | null) ?? "" }) })}
      >
        <Text weight="600" tone={m.vision ? "default" : "muted"}>
          {m.vision || "Tap to write the one-line vision"}
        </Text>
      </Labelled>
      <Labelled label="PROBLEM" color="#ef4444">
        <Text variant="small" tone="muted">
          {pains.length ? pains.map((p) => p.label).join(" · ") : "Add pains in Market Landscape (§6)"}
          {m.problem?.whyNow ? `  —  why now: ${m.problem.whyNow}` : ""}
        </Text>
      </Labelled>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text variant="small" tone="muted">
            You are here
          </Text>
          <Text variant="small" weight="700" mono style={{ color: "#14b8a6" }}>
            {pct}%
          </Text>
        </View>
        <Bar value={view.routeProgress} color="#14b8a6" />
      </View>
      {m.stages.map((s, i) => (
        <View key={s.id} style={{ gap: space.md }}>
          {i > 0 ? <Divider /> : null}
          <StageCard projectId={projectId} stage={s} progress={view.stages.find((x) => x.id === s.id)} edit={edit} />
        </View>
      ))}
      <AddLink
        label="Add stage"
        onPress={() =>
          edit({
            title: "New stage",
            submitLabel: "Add",
            fields: [{ key: "label", label: "Stage name", kind: "text", required: true }],
            initial: { label: "" },
            submit: (v) => run(projectId, { op: "upsertStage", stage: { id: Crypto.randomUUID(), label: String(v.label), status: m.stages.length ? "next" : "active", kpis: [] } }),
          })
        }
      />
    </Block>
  );
}

function StageCard({ projectId, stage, progress, edit }: { projectId: string; stage: Stage; progress?: StrategyView["stages"][number]; edit: Edit }) {
  const { c, space, radius } = useTheme();
  const status = STAGE_STATUS[stage.status];
  const save = (patch: Partial<Stage>) => run(projectId, { op: "upsertStage", stage: { ...stage, ...patch } });
  const next = STAGE_ORDER[(STAGE_ORDER.indexOf(stage.status) + 1) % STAGE_ORDER.length];

  const editStage = () =>
    edit({
      title: stage.label,
      fields: [
        { key: "label", label: "Stage name", kind: "text", required: true },
        { key: "status", label: "Status", kind: "choice", options: STATUS_OPTIONS },
        { key: "what", label: "What", kind: "multiline", placeholder: "offer · motion · who" },
        { key: "why", label: "Why", kind: "multiline", placeholder: "the job this stage does" },
        { key: "exitCriteria", label: "Exit", kind: "multiline", placeholder: "the gate to the next stage" },
        { key: "killCriteria", label: "Kill", kind: "multiline", placeholder: "stop or pivot if this fires" },
      ],
      initial: { label: stage.label, status: stage.status, what: stage.what ?? null, why: stage.why ?? null, exitCriteria: stage.exitCriteria ?? null, killCriteria: stage.killCriteria ?? null },
      submit: (v) =>
        save({
          label: String(v.label),
          status: (v.status as Stage["status"]) ?? stage.status,
          what: (v.what as string | null) ?? undefined,
          why: (v.why as string | null) ?? undefined,
          exitCriteria: (v.exitCriteria as string | null) ?? undefined,
          killCriteria: (v.killCriteria as string | null) ?? undefined,
        }),
      onDelete: () => run(projectId, { op: "removeStage", id: stage.id }),
      deleteLabel: "Remove stage",
    });

  const addKpi = () =>
    edit({
      title: `KPI for ${stage.label}`,
      submitLabel: "Add",
      fields: [
        { key: "name", label: "Name", kind: "text", required: true },
        { key: "current", label: "Current", kind: "number" },
        { key: "target", label: "Target", kind: "number" },
      ],
      initial: { name: "", current: null, target: null },
      submit: (v) => save({ kpis: [...stage.kpis, { name: String(v.name), current: numOrNull(v.current), target: numOrNull(v.target) }] }),
    });

  const editKpi = (k: StageKpi, i: number) =>
    edit({
      title: k.name,
      fields: [
        { key: "name", label: "Name", kind: "text", required: true },
        ...(k.autoKey ? [] : ([{ key: "current", label: "Current", kind: "number" }] satisfies FieldSpec[])),
        { key: "target", label: "Target", kind: "number" },
      ],
      initial: { name: k.name, current: typeof k.current === "number" ? k.current : null, target: k.target ?? null },
      submit: (v) =>
        save({
          kpis: stage.kpis.map((x, j) => (j === i ? { ...x, name: String(v.name), ...(k.autoKey ? {} : { current: typeof k.current === "string" && v.current === null ? k.current : numOrNull(v.current) }), target: numOrNull(v.target) } : x)),
        }),
      onDelete: () => save({ kpis: stage.kpis.filter((_, j) => j !== i) }),
      deleteLabel: "Remove KPI",
    });

  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Pressable onPress={editStage} style={{ flex: 1 }} accessibilityHint="Edit this stage">
          <Text weight="700" style={{ color: "#14b8a6", textTransform: "uppercase", letterSpacing: 1 }}>
            {stage.label}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Status ${status.label}. Tap to change to ${STAGE_STATUS[next].label}.`}
          onPress={() => tap(projectId, { op: "upsertStage", stage: { ...stage, status: next } })}
          style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: stage.status === "next" ? "transparent" : status.color, borderWidth: stage.status === "next" ? 1 : 0, borderColor: c.border }}
        >
          <Text variant="caption" weight="800" style={{ letterSpacing: 1.2, color: stage.status === "next" ? c.mutedForeground : "#fff" }}>
            {status.label.toUpperCase()}
          </Text>
        </Pressable>
      </View>
      {stage.status === "active" && progress ? <Bar value={progress.progress} color="#14b8a6" /> : null}
      <Pressable onPress={editStage} style={{ gap: space.sm }}>
        <Line label="WHAT" value={stage.what} placeholder="offer · motion · who" />
        <Line label="WHY" value={stage.why} placeholder="the job this stage does" />
      </Pressable>
      <Labelled label="KPI">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
          {stage.kpis.map((k, i) => {
            const state = progress?.kpiStates[i] ?? "na";
            return (
              <Pressable key={`${k.name}-${i}`} onPress={() => editKpi(k, i)} style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full, backgroundColor: `${KPI_COLOR[state]}1f` }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: KPI_COLOR[state] }} />
                <Text variant="small">{k.name}</Text>
                <Text variant="small" weight="700" mono>
                  {k.current ?? "—"}
                  {k.target != null ? ` / ${k.target}` : ""}
                </Text>
                {k.autoKey ? <Tag label="auto" color="#0ea5e9" /> : null}
              </Pressable>
            );
          })}
          <AddLink label="KPI" onPress={addKpi} />
        </View>
      </Labelled>
      <Pressable onPress={editStage} style={{ gap: space.sm }}>
        <Line label="EXIT" color="#0ea5e9" value={stage.exitCriteria} placeholder="the gate to the next stage" />
        <Line label="KILL" color="#ef4444" value={stage.killCriteria} placeholder="stop or pivot trigger" />
      </Pressable>
    </View>
  );
}

function Line({ label, value, placeholder, color }: { label: string; value?: string; placeholder: string; color?: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <Text variant="caption" weight="800" tone="muted" style={{ width: 40, letterSpacing: 1.2, paddingTop: 2 }}>
        {label}
      </Text>
      <Text variant="small" tone={value ? "default" : "muted"} style={[{ flex: 1 }, value && color ? { color } : null]}>
        {value || placeholder}
      </Text>
    </View>
  );
}
