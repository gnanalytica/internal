import { useQuery } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { View } from "react-native";

import { Card, Empty, Text, type IconName } from "@/components/ui";
import { projectsQuery } from "@/features/workspace/api";
import { dueLabel, shortDate } from "@/lib/format";
import { useTheme } from "@/theme";

import { optionOf, type Option } from "./constants";

/**
 * Calendar dates arrive as UTC-midnight timestamps. Read the day off the string
 * rather than through the phone's timezone, or west of UTC every date shows a
 * day early (the web's matrix-format.ts makes the same choice).
 */
export const day = (v: string | null | undefined): string | null => (v ? v.slice(0, 10) : null);
export const dayLabel = (v: string | null | undefined): string => (v ? shortDate(day(v)) : "—");
export const dueOf = (v: string | null | undefined) => dueLabel(day(v));

/** The project a department screen belongs to, from the cached project list. */
export function useProject(id: string) {
  const q = useQuery(projectsQuery);
  return q.data?.find((p) => p.id === id) ?? null;
}

/** A two-line header title: the department, and the project under it. */
export function HeaderTitle({ title, project }: { title: string; project?: string | null }) {
  return (
    <View>
      <Text variant="title" numberOfLines={1}>
        {title}
      </Text>
      {project ? (
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {project}
        </Text>
      ) : null}
    </View>
  );
}

export function OptionBadge({ list, value }: { list: Option[]; value: string | null | undefined }) {
  const { radius } = useTheme();
  const o = optionOf(list, value);
  const color = o.color ?? "#94a3b8";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, backgroundColor: `${color}22` }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <Text variant="caption" weight="600" style={{ color }}>
        {o.label}
      </Text>
    </View>
  );
}

export function Dot({ color, size = 9 }: { color?: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color ?? "#94a3b8" }} />;
}

export type Stat = { label: string; value: string; tone?: "default" | "success" | "warning" | "danger" | "muted" };

/** A row of headline numbers, two per line on a phone. */
export function Stats({ items }: { items: Stat[] }) {
  const { space } = useTheme();
  return (
    <Card style={{ flexDirection: "row", flexWrap: "wrap", rowGap: space.md, paddingVertical: space.md }}>
      {items.map((s) => (
        <View key={s.label} style={{ width: "50%", gap: 2, paddingRight: space.sm }}>
          <Text variant="caption" tone="muted" weight="600" style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
            {s.label}
          </Text>
          <Text variant="title" mono tone={s.tone === "danger" ? "danger" : s.tone === "success" ? "success" : s.tone === "warning" ? "warning" : s.tone === "muted" ? "muted" : "default"} numberOfLines={1} adjustsFontSizeToFit>
            {s.value}
          </Text>
        </View>
      ))}
    </Card>
  );
}

/** A thin progress bar, 0–1. */
export function Bar({ value, color, track }: { value: number; color?: string; track?: string }) {
  const { c } = useTheme();
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: track ?? c.muted, overflow: "hidden" }}>
      <View style={{ width: `${pct * 100}%`, height: "100%", borderRadius: 3, backgroundColor: color ?? c.brand }} />
    </View>
  );
}

/** What a caller sees when the department isn't theirs to open. */
export function Restricted({ icon = "lock", title, body }: { icon?: IconName; title: string; body: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.background, justifyContent: "center" }}>
      <Empty icon={icon} title={title} body={body} />
    </View>
  );
}

/** A group header inside a sectioned list: colour dot, label, count, and an optional total. */
export function GroupHeader({ label, color, count, right }: { label: string; color?: string; count: number; right?: ReactNode }) {
  const { c, space } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: space.lg, paddingVertical: 8, backgroundColor: c.muted }}>
      {color ? <Dot color={color} /> : null}
      <Text variant="small" weight="600">
        {label}
      </Text>
      <Text variant="small" tone="muted">
        {count}
      </Text>
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}
