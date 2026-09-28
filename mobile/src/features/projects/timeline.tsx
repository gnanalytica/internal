import { router } from "expo-router";
import { useRef } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Empty, Text } from "@/components/ui";
import { shortDate } from "@/lib/format";
import { useTheme } from "@/theme";

import type { ProjectSummary } from "./api";
import { ListCard } from "./components";

const MONTH = 84; // px per month
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const monthStart = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
const addMonths = (ms: number, n: number) => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1);
};

/**
 * Projects laid out by start → target date on a month grid, like the web's
 * roadmap. Scrolls sideways; a line marks today. Projects without both dates
 * are listed underneath rather than guessed at.
 */
export function ProjectTimeline({ projects }: { projects: ProjectSummary[] }) {
  const { c, space, radius } = useTheme();
  const dated = projects.filter((p) => p.startDate && p.targetDate);
  const undated = projects.filter((p) => !(p.startDate && p.targetDate));
  const now = Date.now();
  const scroller = useRef<ScrollView>(null);

  if (projects.length === 0) return <Empty icon="calendar" title="No projects yet" body="Projects with a start and target date show here on a timeline." />;

  let body = null;
  if (dated.length) {
    const times = dated.flatMap((p) => [Date.parse(p.startDate!), Date.parse(p.targetDate!)]);
    const start = monthStart(new Date(Math.min(...times, now)));
    let end = addMonths(monthStart(new Date(Math.max(...times, now))), 1);
    const months: number[] = [];
    for (let m = start; m < end; m = addMonths(m, 1)) months.push(m);
    while (months.length < 4) {
      months.push(end);
      end = addMonths(end, 1);
    }
    const total = end - start;
    const width = months.length * MONTH;
    const xOf = (t: number) => ((t - start) / total) * width;
    const todayX = xOf(now);
    const rows = [...dated].sort((a, b) => Date.parse(a.startDate!) - Date.parse(b.startDate!));

    body = (
      <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} onContentSizeChange={() => scroller.current?.scrollTo({ x: Math.max(0, todayX - 120), animated: false })}>
        <View style={{ width, paddingBottom: space.sm }}>
          <View style={{ flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: c.border }}>
            {months.map((m) => {
              const d = new Date(m);
              return (
                <View key={m} style={{ width: MONTH, paddingVertical: 6, paddingLeft: 6, borderLeftWidth: 0.5, borderLeftColor: c.border }}>
                  <Text variant="caption" tone="muted" weight="600">
                    {MONTHS[d.getUTCMonth()]}
                    {d.getUTCMonth() === 0 || m === months[0] ? ` ${d.getUTCFullYear()}` : ""}
                  </Text>
                </View>
              );
            })}
          </View>
          <View>
            {rows.map((p) => {
              const x1 = xOf(Date.parse(p.startDate!));
              const x2 = Math.max(x1 + 6, xOf(Date.parse(p.targetDate!)));
              const labelLeft = Math.max(4, Math.min(x1, width - 180));
              return (
                <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`${p.name}, ${shortDate(p.startDate)} to ${shortDate(p.targetDate)}`} onPress={() => router.push(`/projects/${p.id}`)} style={({ pressed }) => ({ height: 54, opacity: pressed ? 0.7 : 1 })}>
                  <Text variant="small" weight="600" numberOfLines={1} style={{ position: "absolute", left: labelLeft, top: 6, width: 176 }}>
                    {p.name}
                    <Text variant="caption" tone="muted">
                      {`  ${shortDate(p.startDate)} – ${shortDate(p.targetDate)}`}
                    </Text>
                  </Text>
                  <View style={{ position: "absolute", left: x1, width: x2 - x1, top: 28, height: 14, borderRadius: radius.sm, backgroundColor: `${p.color}33`, overflow: "hidden" }}>
                    <View style={{ width: `${p.progress.pct}%`, height: 14, backgroundColor: p.color }} />
                  </View>
                </Pressable>
              );
            })}
            <View pointerEvents="none" style={{ position: "absolute", left: todayX, top: 0, bottom: 0, width: 1.5, backgroundColor: c.destructive, opacity: 0.8 }} />
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={{ gap: space.lg }}>
      {body ?? <Text tone="muted">No project has both a start and a target date yet. Set them on a project's overview.</Text>}
      {dated.length ? (
        <Text variant="caption" tone="muted">
          Bars run from start to target date and fill as tasks get done. The red line is today.
        </Text>
      ) : null}
      {undated.length ? (
        <View style={{ gap: space.sm }}>
          <Text variant="small" tone="muted" weight="600" style={{ textTransform: "uppercase", letterSpacing: 0.6 }}>
            Not scheduled
          </Text>
          <ListCard>
            {undated.map((p) => (
              <Pressable key={p.id} onPress={() => router.push(`/projects/${p.id}`)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, padding: space.md, paddingHorizontal: space.lg, backgroundColor: pressed ? c.muted : c.card })}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.color }} />
                <Text style={{ flex: 1 }} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text variant="small" tone="muted">
                  {p.startDate ? `Starts ${shortDate(p.startDate)}` : p.targetDate ? `Due ${shortDate(p.targetDate)}` : "No dates"}
                </Text>
              </Pressable>
            ))}
          </ListCard>
        </View>
      ) : null}
    </View>
  );
}
