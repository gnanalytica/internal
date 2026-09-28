import { type ReactNode } from "react";
import { Alert, Pressable, View } from "react-native";

import { Card, Icon, Text } from "@/components/ui";
import { useTheme } from "@/theme";

import { applyStrategy, type KpiState, type StageStatus, type StrategyOp } from "../api";

export const STAGE_STATUS: Record<StageStatus, { label: string; color: string }> = {
  active: { label: "Active", color: "#14b8a6" },
  next: { label: "Next", color: "#94a3b8" },
  goal: { label: "Goal", color: "#f59e0b" },
  done: { label: "Done", color: "#059669" },
};
export const STAGE_ORDER: StageStatus[] = ["active", "next", "goal", "done"];

export const KPI_COLOR: Record<KpiState, string> = { ok: "#10b981", warn: "#f59e0b", bad: "#ef4444", na: "#94a3b8" };

/** Apply one strategy edit. Form sheets report a failure themselves. */
export const run = (projectId: string, op: StrategyOp): Promise<void> => applyStrategy(projectId, op);

/** Apply an edit from a single tap, telling the person when it didn't land. */
export function tap(projectId: string, op: StrategyOp): void {
  applyStrategy(projectId, op).catch((e: Error) => Alert.alert("Couldn't save that", e.message));
}

/** A numbered strategy section, like the web's §1–§6 cards. */
export function Block({ n, title, sub, action, children }: { n: number; title: string; sub?: string; action?: ReactNode; children: ReactNode }) {
  const { space, radius } = useTheme();
  return (
    <Card style={{ gap: space.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <View style={{ width: 22, height: 22, borderRadius: radius.sm, backgroundColor: "#14b8a6", alignItems: "center", justifyContent: "center" }}>
          <Text variant="caption" weight="800" style={{ color: "#fff" }}>
            {n}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="title">{title}</Text>
          {sub ? (
            <Text variant="caption" tone="muted">
              {sub}
            </Text>
          ) : null}
        </View>
        {action}
      </View>
      <View style={{ gap: space.md }}>{children}</View>
    </Card>
  );
}

/** A small uppercase label with its value beside or under it. */
export function Labelled({ label, color, children, onPress }: { label: string; color?: string; children: ReactNode; onPress?: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => ({ gap: 2, opacity: pressed ? 0.7 : 1 })}>
      <Text variant="caption" weight="800" style={{ letterSpacing: 1.2, color: color ?? c.mutedForeground }}>
        {label}
      </Text>
      {children}
    </Pressable>
  );
}

/** Inline "+ add" link at the foot of a list. */
export function AddLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", opacity: pressed ? 0.6 : 1 })}>
      <Icon name="plus" size={15} color={c.brand} />
      <Text variant="small" tone="brand" weight="600">
        {label}
      </Text>
    </Pressable>
  );
}

/** A compact tag. */
export function Tag({ label, color, onPress }: { label: string; color?: string; onPress?: () => void }) {
  const { c, radius } = useTheme();
  const tint = color ?? c.mutedForeground;
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full, borderWidth: 1, borderColor: `${tint}55` }}>
      <Text variant="caption" weight="700" style={{ color: tint }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Parse an optional number from a form value. */
export const numOrNull = (v: unknown): number | null => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
