import { router } from "expo-router";
import { View } from "react-native";

import { Badge, Card, Text } from "@/components/ui";
import { shortDate } from "@/lib/format";
import { useTheme } from "@/theme";

import type { CycleRow, CycleState } from "./api";
import { ColorDot, ProgressBar } from "./components";

const DAY = 86_400_000;

/** "3 days left", "starts in 2 days", "ended 4 days ago" — the web's cycleTiming. */
export function cycleTiming(c: { startDate: string; endDate: string }, now = Date.now()): string | null {
  const start = Date.parse(c.startDate);
  const end = Date.parse(c.endDate);
  if (now < start) {
    const days = Math.ceil((start - now) / DAY);
    return days <= 1 ? "starts tomorrow" : days <= 14 ? `starts in ${days} days` : null;
  }
  if (now > end) {
    const ago = Math.ceil((now - end) / DAY);
    return ago <= 1 ? "ended yesterday" : ago <= 30 ? `ended ${ago} days ago` : null;
  }
  const left = Math.ceil((end - now) / DAY);
  return left <= 0 ? "ends today" : left === 1 ? "1 day left" : `${left} days left`;
}

export const cycleRange = (c: { startDate: string; endDate: string }) => `${shortDate(c.startDate)} – ${shortDate(c.endDate)}`;

export function CycleStateBadge({ state }: { state: CycleState }) {
  if (state === "active") return <Badge label="Active" tone="brand" dot />;
  if (state === "upcoming") return <Badge label="Upcoming" />;
  return <Badge label="Completed" tone="success" />;
}

/** One cycle as a card: name, dates, timing, progress by tasks and points. */
export function CycleCard({ cycle, showProject }: { cycle: CycleRow; showProject?: boolean }) {
  const { c } = useTheme();
  const timing = cycleTiming(cycle);
  return (
    <Card onPress={() => router.push(`/cycles/${cycle.id}`)}>
      {showProject ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ColorDot color={cycle.project.color} />
          <Text variant="small" tone="muted" weight="600" numberOfLines={1} style={{ flex: 1 }}>
            {cycle.project.name}
          </Text>
          <CycleStateBadge state={cycle.state} />
        </View>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text variant="title" numberOfLines={1} style={{ flex: 1 }}>
          {cycle.name}
        </Text>
        {showProject ? null : <CycleStateBadge state={cycle.state} />}
      </View>
      <Text variant="small" tone="muted">
        {cycleRange(cycle)}
        {timing ? ` · ${timing}` : ""}
      </Text>
      <ProgressBar pct={cycle.progress.pct} color={cycle.state === "completed" ? c.success : undefined} />
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text variant="small" tone="muted" mono>
          {cycle.doneCount}/{cycle.issueCount} tasks · {cycle.progress.pct}%
        </Text>
        <Text variant="small" tone="muted" mono>
          {cycle.points.done}/{cycle.points.total} pts
        </Text>
      </View>
    </Card>
  );
}
