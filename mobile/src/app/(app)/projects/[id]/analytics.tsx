import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";

import { Badge, Button, Card, Empty, ErrorView, Icon, Input, Loading, Screen, Sheet, Text } from "@/components/ui";
import { addMetricPoint, createMetric, metricsQuery, projectQuery, updateMetric, type Metric } from "@/features/projects/api";
import { Sparkline } from "@/features/projects/charts";
import { Chips, SheetActions } from "@/features/projects/components";
import { formatTarget, formatValue, METRIC_CADENCES, onTarget } from "@/features/projects/constants";
import { isoDay, shortDate } from "@/lib/format";
import { useTheme } from "@/theme";

/** A project's KPIs: latest against previous, the target, the trend, and a way to log this period's value. */
export default function AnalyticsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { space } = useTheme();
  const project = useQuery(projectQuery(id)).data;
  const q = useQuery(metricsQuery(id));
  const [adding, setAdding] = useState(false);
  const [logging, setLogging] = useState<Metric | null>(null);
  const [editing, setEditing] = useState<Metric | null>(null);

  return (
    <>
      <Stack.Screen options={{ title: project ? `${project.name} · Analytics` : "Analytics", headerRight: () => <Button size="sm" variant="ghost" icon="plus" title="Metric" onPress={() => setAdding(true)} /> }} />
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorView error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
          {q.data.length ? (
            <View style={{ gap: space.md }}>
              {q.data.map((m) => (
                <MetricCard key={m.id} metric={m} onLog={() => setLogging(m)} onEdit={() => setEditing(m)} />
              ))}
            </View>
          ) : (
            <Empty icon="bar-chart-2" title="No metrics yet" body="Track the numbers this product steers by: activation, retention, revenue, accuracy." action={<Button title="Add a metric" icon="plus" variant="brand" onPress={() => setAdding(true)} style={{ marginTop: space.sm }} />} />
          )}
        </Screen>
      )}
      <NewMetricSheet visible={adding} onClose={() => setAdding(false)} projectId={id} />
      <LogPointSheet key={logging?.id ?? "none"} metric={logging} onClose={() => setLogging(null)} projectId={id} />
      <TargetSheet key={`t-${editing?.id ?? "none"}`} metric={editing} onClose={() => setEditing(null)} projectId={id} />
    </>
  );
}

function MetricCard({ metric: m, onLog, onEdit }: { metric: Metric; onLog: () => void; onEdit: () => void }) {
  const { c } = useTheme();
  const delta = m.latest != null && m.previous != null ? m.latest - m.previous : null;
  const target = formatTarget(m.target, m.targetDirection, m.unit);
  const hit = onTarget(m.latest, m.target, m.targetDirection);
  // Up is good unless the target is a ceiling.
  const good = delta == null || delta === 0 ? null : m.targetDirection === "below" ? delta < 0 : delta > 0;
  const lastPoint = m.points[m.points.length - 1];
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {m.isNorthStar ? <Icon name="star" size={15} color="#f5b400" /> : null}
        <Text weight="600" numberOfLines={1} style={{ flex: 1 }}>
          {m.name}
        </Text>
        <Text variant="caption" tone="muted">
          {METRIC_CADENCES.find((x) => x.id === m.cadence)?.label ?? m.cadence}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="display" mono numberOfLines={1} adjustsFontSizeToFit>
            {formatValue(m.latest, m.unit)}
          </Text>
          <Text variant="small" tone="muted" mono>
            {delta == null ? (m.latest == null ? "No values yet" : "First value") : `${delta > 0 ? "▲" : delta < 0 ? "▼" : "="} ${formatValue(Math.abs(delta), m.unit)} vs ${formatValue(m.previous, m.unit)}`}
          </Text>
        </View>
        <Sparkline values={m.points.slice(-12).map((p) => p.value)} target={m.target} color={good === false ? c.destructive : undefined} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {target ? (
          hit === null ? <Badge label={`Target ${target}`} /> : <Badge label={`${hit ? "On target" : "Off target"} · ${target}`} tone={hit ? "success" : "warning"} dot />
        ) : (
          <Text variant="small" tone="brand" onPress={onEdit}>
            Set a target
          </Text>
        )}
        {lastPoint ? (
          <Text variant="caption" tone="muted">
            Last logged {shortDate(lastPoint.periodDate)}
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button size="sm" title="Log a value" icon="plus" style={{ flex: 1 }} onPress={onLog} />
        <Button size="sm" title="Target" icon="crosshair" variant="ghost" onPress={onEdit} />
      </View>
    </Card>
  );
}

const DIRECTIONS = [
  { id: "above", label: "At least" },
  { id: "below", label: "At most" },
] as const;

function NewMetricSheet({ visible, onClose, projectId }: { visible: boolean; onClose: () => void; projectId: string }) {
  const { space } = useTheme();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [cadence, setCadence] = useState<string>("monthly");
  const [target, setTarget] = useState("");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [saving, setSaving] = useState(false);
  const targetOk = !target.trim() || Number.isFinite(Number(target));
  const save = async () => {
    setSaving(true);
    try {
      await createMetric({ projectId, name: name.trim(), unit: unit.trim() || null, cadence, target: target.trim() ? Number(target) : null, targetDirection: direction });
      setName("");
      setUnit("");
      setTarget("");
      onClose();
    } catch (e) {
      Alert.alert("Couldn't add the metric", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="New metric">
      <View style={{ padding: space.lg, paddingTop: 0, gap: space.md }}>
        <Input label="Name" placeholder="e.g. Weekly active valuers" value={name} onChangeText={setName} autoFocus />
        <Input label="Unit" placeholder="e.g. users, %, ₹ (optional)" value={unit} onChangeText={setUnit} autoCapitalize="none" />
        <Chips value={cadence} onChange={setCadence} options={METRIC_CADENCES} />
        <Chips value={direction} onChange={setDirection} options={DIRECTIONS} />
        <Input label="Target" placeholder="Optional" value={target} onChangeText={setTarget} keyboardType="decimal-pad" hint={targetOk ? undefined : "Enter a number."} />
        <SheetActions onCancel={onClose} onSave={() => void save()} saveLabel="Add metric" saving={saving} disabled={!name.trim() || !targetOk} />
      </View>
    </Sheet>
  );
}

function LogPointSheet({ metric, onClose, projectId }: { metric: Metric | null; onClose: () => void; projectId: string }) {
  const { space } = useTheme();
  const [value, setValue] = useState("");
  const [date, setDate] = useState(isoDay(new Date()));
  const [saving, setSaving] = useState(false);
  const ok = value.trim() !== "" && Number.isFinite(Number(value)) && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const save = async () => {
    if (!metric) return;
    setSaving(true);
    try {
      await addMetricPoint(metric.id, projectId, date, Number(value));
      onClose();
    } catch (e) {
      Alert.alert("Couldn't log the value", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet visible={!!metric} onClose={onClose} title={metric ? `Log ${metric.name}` : "Log a value"}>
      <View style={{ padding: space.lg, paddingTop: 0, gap: space.md }}>
        <Input label={metric?.unit ? `Value (${metric.unit})` : "Value"} value={value} onChangeText={setValue} keyboardType="decimal-pad" autoFocus />
        <Input label="For the period starting" value={date} onChangeText={setDate} autoCapitalize="none" keyboardType="numbers-and-punctuation" hint="yyyy-mm-dd" />
        <SheetActions onCancel={onClose} onSave={() => void save()} saveLabel="Log value" saving={saving} disabled={!ok} />
      </View>
    </Sheet>
  );
}

function TargetSheet({ metric, onClose, projectId }: { metric: Metric | null; onClose: () => void; projectId: string }) {
  const { space } = useTheme();
  const [target, setTarget] = useState(metric?.target != null ? String(metric.target) : "");
  const [direction, setDirection] = useState<"above" | "below">(metric?.targetDirection ?? "above");
  const [northStar, setNorthStar] = useState<"yes" | "no">(metric?.isNorthStar ? "yes" : "no");
  const ok = !target.trim() || Number.isFinite(Number(target));
  return (
    <Sheet visible={!!metric} onClose={onClose} title={metric ? metric.name : "Target"}>
      <View style={{ padding: space.lg, paddingTop: 0, gap: space.md }}>
        <Chips value={direction} onChange={setDirection} options={DIRECTIONS} />
        <Input label={metric?.unit ? `Target (${metric.unit})` : "Target"} placeholder="Leave empty to just track the trend" value={target} onChangeText={setTarget} keyboardType="decimal-pad" hint={ok ? undefined : "Enter a number."} />
        <View style={{ gap: 6 }}>
          <Text variant="small" tone="muted" weight="500">
            North-star metric
          </Text>
          <Chips
            value={northStar}
            onChange={setNorthStar}
            options={[
              { id: "yes", label: "Yes" },
              { id: "no", label: "No" },
            ]}
          />
        </View>
        <SheetActions
          onCancel={onClose}
          disabled={!ok}
          onSave={() => {
            if (metric)
              void updateMetric(metric.id, projectId, { target: target.trim() ? Number(target) : null, targetDirection: direction, isNorthStar: northStar === "yes" }).catch((e: Error) => Alert.alert("Couldn't save", e.message));
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}
