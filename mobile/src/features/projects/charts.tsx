import { useState } from "react";
import { Pressable, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";

import { Text } from "@/components/ui";
import { shortDate } from "@/lib/format";
import { useTheme } from "@/theme";

const path = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

/**
 * A metric's recent trend: one 2px line, the last point marked, and the target
 * as a dashed rule when it falls inside the range. No axes — the card around it
 * carries the numbers.
 */
export function Sparkline({ values, target, width = 120, height = 36, color }: { values: number[]; target?: number | null; width?: number; height?: number; color?: string }) {
  const { c } = useTheme();
  const stroke = color ?? c.brand;
  if (values.length < 2) {
    return (
      <View style={{ width, height, justifyContent: "center" }}>
        <Text variant="caption" tone="muted">
          {values.length ? "One point so far" : "No points yet"}
        </Text>
      </View>
    );
  }
  const all = target != null ? [...values, target] : values;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const pad = 4;
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);
  const pts = values.map((v, i) => [x(i), y(v)] as [number, number]);
  const last = pts[pts.length - 1];
  return (
    <Svg width={width} height={height} accessibilityLabel={`Trend over ${values.length} points`}>
      {target != null ? <Line x1={pad} x2={width - pad} y1={y(target)} y2={y(target)} stroke={c.mutedForeground} strokeWidth={1} strokeDasharray="3 3" opacity={0.7} /> : null}
      <Path d={path(pts)} stroke={stroke} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={last[0]} cy={last[1]} r={4} fill={stroke} stroke={c.card} strokeWidth={2} />
    </Svg>
  );
}

type BurnPoint = { date: string; remaining: number; ideal: number };

/**
 * Remaining points per day against the ideal line, as on the web's cycle page.
 * Tap anywhere on the plot to read a day's numbers.
 */
export function BurndownChart({ points, totalPoints, endDate }: { points: BurnPoint[]; totalPoints: number; endDate: string }) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const height = 180;
  const left = 28;
  const right = 8;
  const top = 8;
  const bottom = 22;

  if (points.length === 0 || totalPoints === 0) {
    return (
      <Text tone="muted" style={{ paddingVertical: 12 }}>
        Nothing in this cycle yet, so there is nothing to burn down.
      </Text>
    );
  }

  // The x axis always spans the whole cycle, so a cycle in progress shows how far is left.
  const startMs = Date.parse(`${points[0].date}T00:00:00Z`);
  const endMs = Date.parse(endDate);
  const spanDays = Math.max(1, Math.round((endMs - startMs) / 86_400_000));
  const max = Math.max(totalPoints, ...points.map((p) => p.remaining));
  const plotW = Math.max(1, width - left - right);
  const plotH = height - top - bottom;
  const x = (day: number) => left + (Math.min(day, spanDays) / spanDays) * plotW;
  const y = (v: number) => top + (1 - v / max) * plotH;
  const remaining = points.map((p, i) => [x(i), y(p.remaining)] as [number, number]);
  const ideal: [number, number][] = [
    [x(0), y(totalPoints)],
    [x(spanDays), y(0)],
  ];
  const sel = picked !== null ? points[picked] : points[points.length - 1];
  const selIndex = picked ?? points.length - 1;
  const gridValues = [0, Math.round(max / 2), max];

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <Legend color={c.brand} label="Remaining" />
        <Legend color={c.mutedForeground} label="Ideal" dashed />
        <Text variant="small" tone="muted" style={{ marginLeft: "auto" }} mono>
          {shortDate(sel.date)} · {sel.remaining} left
        </Text>
      </View>
      <Pressable
        accessibilityLabel={`Burndown: ${sel.remaining} of ${totalPoints} points remaining on ${shortDate(sel.date)}`}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onPress={(e) => {
          if (!width) return;
          const day = Math.round(((e.nativeEvent.locationX - left) / plotW) * spanDays);
          setPicked(Math.max(0, Math.min(points.length - 1, day)));
        }}
        style={{ height }}
      >
        {width > 0 ? (
          <Svg width={width} height={height}>
            {gridValues.map((v) => (
              <Line key={v} x1={left} x2={width - right} y1={y(v)} y2={y(v)} stroke={c.border} strokeWidth={1} />
            ))}
            <Path d={path(ideal)} stroke={c.mutedForeground} strokeWidth={1.5} strokeDasharray="4 4" fill="none" />
            <Path d={path(remaining)} stroke={c.brand} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            <Line x1={x(selIndex)} x2={x(selIndex)} y1={top} y2={top + plotH} stroke={c.mutedForeground} strokeWidth={1} opacity={0.5} />
            <Circle cx={x(selIndex)} cy={y(sel.remaining)} r={5} fill={c.brand} stroke={c.card} strokeWidth={2} />
          </Svg>
        ) : null}
        {width > 0
          ? gridValues.map((v) => (
              <Text key={v} variant="caption" tone="muted" mono style={{ position: "absolute", left: 0, width: left - 6, textAlign: "right", top: y(v) - 7 }}>
                {v}
              </Text>
            ))
          : null}
        <View style={{ position: "absolute", left, right, bottom: 0, flexDirection: "row", justifyContent: "space-between" }}>
          <Text variant="caption" tone="muted">
            {shortDate(points[0].date)}
          </Text>
          <Text variant="caption" tone="muted">
            {shortDate(endDate)}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Svg width={16} height={4}>
        <Line x1={0} x2={16} y1={2} y2={2} stroke={color} strokeWidth={2} strokeDasharray={dashed ? "3 3" : undefined} />
      </Svg>
      <Text variant="small" tone="muted">
        {label}
      </Text>
    </View>
  );
}
