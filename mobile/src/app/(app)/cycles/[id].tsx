import { useQuery } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { Card, ErrorView, Loading, Text } from "@/components/ui";
import { IssueList } from "@/features/issues/issue-list";
import { cycleQuery, type CycleDetail } from "@/features/projects/api";
import { BurndownChart } from "@/features/projects/charts";
import { ColorDot, ProgressBar, Stat } from "@/features/projects/components";
import { CycleStateBadge, cycleRange, cycleTiming } from "@/features/projects/cycle-card";
import { useTheme } from "@/theme";

/** One cycle: its dates and progress, the burndown, and its tasks by status. */
export default function CycleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery(cycleQuery(id));
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  const c = q.data;
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: c.name }} />
      <IssueList filters={{ cycle: id }} header={<CycleHeader cycle={c} />} emptyTitle="No tasks in this cycle" emptyBody="Set a task's cycle to plan it into this one." />
    </View>
  );
}

function CycleHeader({ cycle: c }: { cycle: CycleDetail }) {
  const { space } = useTheme();
  const timing = cycleTiming(c);
  const open = c.issueCount - c.doneCount - (c.byStatus.canceled ?? 0);
  return (
    <View style={{ padding: space.lg, gap: space.md }}>
      {c.project ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ColorDot color={c.project.color} />
          <Text variant="small" tone="muted" weight="600" style={{ flex: 1 }} onPress={() => router.push(`/projects/${c.projectId}/cycles`)}>
            {c.project.name}
          </Text>
          <CycleStateBadge state={c.state} />
        </View>
      ) : null}
      <Text tone="muted">
        {cycleRange(c)}
        {timing ? ` · ${timing}` : ""}
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Stat value={`${c.progress.pct}%`} label="done" />
        <Stat value={`${c.points.done}/${c.points.total}`} label="points" />
        <Stat value={String(Math.max(0, open))} label="open tasks" />
      </View>
      <ProgressBar pct={c.progress.pct} />
      <Card>
        <Text weight="600">Burndown</Text>
        <BurndownChart points={c.burndown.points} totalPoints={c.burndown.totalPoints} endDate={c.endDate} />
        <Text variant="caption" tone="muted">
          Points still open each day, against a straight line to zero. Tap the chart to read a day.
        </Text>
      </Card>
    </View>
  );
}
