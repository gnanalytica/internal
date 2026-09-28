import * as Crypto from "expo-crypto";
import { useState } from "react";
import { Alert, Linking, Pressable, View } from "react-native";

import { Divider, Icon, Row, Sheet, Text, type IconName } from "@/components/ui";
import { useTheme } from "@/theme";

import type { MilestoneProgress, Signal, StrategyView } from "../api";
import { Bar } from "../ui";
import type { Edit } from "./path-to-scale";
import { AddLink, Block, run, Tag, tap } from "./shared";

const PILLAR_COLOR = { desirability: "#ec4899", feasibility: "#14b8a6", viability: "#f59e0b" } as const;

/** §2 — Desirability · Feasibility · Viability. A pillar's score is its ✓ signals over all of them. */
export function Scorecard({ projectId, view, milestones, edit }: { projectId: string; view: StrategyView; milestones: MilestoneProgress[]; edit: Edit }) {
  const { space } = useTheme();
  return (
    <Block n={2} title="FDV Scorecard" sub="score = ✓ ÷ signals · tap ✓/✕ to re-assess">
      {view.pillars.map((p, i) => {
        const signals = view.model.signals.filter((s) => s.pillar === p.id);
        const trend = p.history.length >= 2 ? p.history[p.history.length - 1] - p.history[0] : null;
        return (
          <View key={p.id} style={{ gap: space.sm }}>
            {i > 0 ? <Divider /> : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 4, borderColor: p.score === null ? "#94a3b8" : PILLAR_COLOR[p.id], alignItems: "center", justifyContent: "center" }}>
                <Text weight="800" mono>
                  {p.score === null ? "—" : `${p.score}`}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text weight="700" style={{ textTransform: "uppercase", letterSpacing: 1 }}>
                  {p.label}
                </Text>
                <Text variant="small" tone="muted">
                  {p.question} · {p.ok} / {p.total} signals
                  {trend !== null && trend !== 0 ? ` · ${trend > 0 ? "▲" : "▼"} ${Math.abs(trend)} since first check` : ""}
                </Text>
              </View>
            </View>
            {signals.map((s) => (
              <SignalRow key={s.id} projectId={projectId} signal={s} stale={view.staleSignalIds.includes(s.id)} edit={edit} />
            ))}
            {p.id === "feasibility" && milestones.length ? (
              <View style={{ gap: 6, paddingTop: 4 }}>
                <Text variant="caption" tone="muted" weight="600" style={{ textTransform: "uppercase", letterSpacing: 0.6 }}>
                  Capability burn-up · from the roadmap
                </Text>
                {milestones.slice(0, 4).map((m) => (
                  <ProgressRow key={m.id} label={m.name} value={m.total ? m.closed / m.total : 0} detail={m.total ? `${Math.round((m.closed / m.total) * 100)}%` : "no tasks"} />
                ))}
              </View>
            ) : null}
            <AddLink
              label={`${p.label} signal`}
              onPress={() =>
                edit({
                  title: `New ${p.label.toLowerCase()} signal`,
                  submitLabel: "Add",
                  fields: [
                    { key: "claim", label: "Claim", kind: "text", required: true, placeholder: "keyword claim" },
                    { key: "why", label: "Why · flip condition", kind: "multiline" },
                    { key: "source", label: "Source", kind: "text", placeholder: "e.g. 12 valuer interviews" },
                  ],
                  initial: { claim: "", why: null, source: null },
                  submit: (v) =>
                    run(projectId, {
                      op: "upsertSignal",
                      signal: { id: Crypto.randomUUID(), pillar: p.id, claim: String(v.claim), ok: false, why: v.why ?? undefined, source: v.source ? { label: String(v.source) } : undefined, date: new Date().toISOString().slice(0, 10) },
                    }),
                })
              }
            />
          </View>
        );
      })}
    </Block>
  );
}

function SignalRow({ projectId, signal, stale, edit }: { projectId: string; signal: Signal; stale: boolean; edit: Edit }) {
  const { c, space, radius } = useTheme();
  const color = signal.ok ? "#10b981" : "#ef4444";

  const [menu, setMenu] = useState(false);
  const more = () => setMenu(true);
  const actions: { text: string; icon: IconName; onPress: () => void }[] = [
    {
      text: "Edit or remove",
      icon: "edit-2",
      onPress: () =>
        edit({
          title: "Signal",
          fields: [
            { key: "claim", label: "Claim", kind: "text", required: true },
            { key: "why", label: "Why · flip condition", kind: "multiline" },
            { key: "source", label: "Source", kind: "text" },
          ],
          initial: { claim: signal.claim, why: signal.why ?? null, source: signal.source?.label ?? null },
          submit: (v) =>
            run(projectId, {
              op: "upsertSignal",
              signal: { ...signal, claim: String(v.claim), why: v.why ?? undefined, source: v.source ? { ...signal.source, label: String(v.source) } : undefined, date: new Date().toISOString().slice(0, 10) },
            }),
          onDelete: () => run(projectId, { op: "removeSignal", id: signal.id }),
          deleteLabel: "Remove signal",
        }),
    },
  ];
  if (!signal.riskiest) actions.push({ text: "Mark as the riskiest in this pillar", icon: "alert-triangle", onPress: () => tap(projectId, { op: "setRiskiest", id: signal.id }) });
  if (!signal.ok) actions.push({ text: "Queue as an initiative", icon: "corner-down-right", onPress: () => tap(projectId, { op: "upsertInitiative", initiative: { id: Crypto.randomUUID(), name: signal.claim, signalId: signal.id, stageId: signal.stageId } }) });
  if (signal.source?.href) actions.push({ text: `Open ${signal.source.label}`, icon: "external-link", onPress: () => void Linking.openURL(signal.source!.href!).catch(() => Alert.alert("Couldn't open that link")) });

  return (
    <>
      <Sheet visible={menu} onClose={() => setMenu(false)} title={signal.claim}>
        <Text tone="muted" style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
          {signal.why || "No reasoning recorded."}
        </Text>
        {actions.map((a) => (
          <Row
            key={a.text}
            title={a.text}
            leading={<Icon name={a.icon} color={c.mutedForeground} />}
            onPress={() => {
              setMenu(false);
              a.onPress();
            }}
          />
        ))}
      </Sheet>
      <Pressable onPress={more} style={({ pressed }) => ({ flexDirection: "row", alignItems: "flex-start", gap: space.sm, paddingVertical: 4, opacity: pressed ? 0.7 : 1 })}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={signal.autoKey ? `${signal.ok ? "Holds" : "Doesn't hold"}, derived automatically` : `${signal.ok ? "Holds" : "Doesn't hold"}. Tap to re-assess.`}
          disabled={!!signal.autoKey}
          hitSlop={8}
          onPress={() => tap(projectId, { op: "flipSignal", id: signal.id })}
          style={{ width: 22, height: 22, borderRadius: radius.sm, borderWidth: 1, borderColor: `${color}88`, backgroundColor: `${color}1a`, alignItems: "center", justifyContent: "center", marginTop: 1 }}
        >
          <Text weight="800" style={{ color, fontSize: 12 }}>
            {signal.ok ? "✓" : "✕"}
          </Text>
        </Pressable>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: signal.ok ? c.foreground : c.mutedForeground }}>{signal.claim}</Text>
          {signal.riskiest || signal.autoKey || stale || signal.source || signal.stageId ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
              {signal.riskiest ? <Tag label="RISKIEST" color="#ef4444" /> : null}
              {signal.autoKey ? <Tag label="auto" color="#0ea5e9" /> : null}
              {stale ? <Tag label="stale" color="#f59e0b" /> : null}
              {signal.stageId ? <Tag label={signal.stageId} color="#8b5cf6" /> : null}
              {signal.source ? <Tag label={signal.source.label} /> : null}
            </View>
          ) : null}
        </View>
      </Pressable>
    </>
  );
}

/** A progress bar row used by initiatives and proof metrics. */
export function ProgressRow({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <Text variant="small" style={{ flex: 1 }} numberOfLines={2}>
          {label}
        </Text>
        <Text variant="small" tone="muted" mono>
          {detail}
        </Text>
      </View>
      <Bar value={value} color="#14b8a6" />
    </View>
  );
}
