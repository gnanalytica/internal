import { useQuery } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";

import { Button, Card, Empty, ErrorView, Input, Loading, Screen, Section, Sheet, Text } from "@/components/ui";
import { createCycle, projectCyclesQuery, projectQuery, type CycleRow, type Velocity } from "@/features/projects/api";
import { SheetActions, Stat } from "@/features/projects/components";
import { CycleCard } from "@/features/projects/cycle-card";
import { isoDay } from "@/lib/format";
import { useTheme } from "@/theme";

/** A project's cycles: the cadence, velocity, and every sprint — current first. */
export default function ProjectCyclesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { space } = useTheme();
  const project = useQuery(projectQuery(id)).data;
  const q = useQuery(projectCyclesQuery(id));
  const [adding, setAdding] = useState(false);

  const title = project ? `${project.name} · Cycles` : "Cycles";
  const header = <Stack.Screen options={{ title, headerRight: () => <Button size="sm" variant="ghost" icon="plus" title="Cycle" onPress={() => setAdding(true)} /> }} />;
  if (q.isPending) return (<>{header}<Loading /></>);
  if (q.isError) return (<>{header}<ErrorView error={q.error} onRetry={() => void q.refetch()} /></>);

  const { cycles, velocity } = q.data;
  const active = cycles.filter((c) => c.state === "active");
  const upcoming = cycles.filter((c) => c.state === "upcoming").reverse();
  const done = cycles.filter((c) => c.state === "completed");
  const ceremonies = project?.cycleCadence?.ceremonies ?? [];
  const last = cycles[0];

  return (
    <>
      {header}
      <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
        {velocity && velocity.cycles.length ? <VelocityCard velocity={velocity} /> : null}

        {ceremonies.length ? (
          <Section title="Cadence">
            <Card style={{ gap: 6 }}>
              {ceremonies.map((cer, i) => (
                <View key={i} style={{ flexDirection: "row", gap: 8 }}>
                  <Text variant="small" tone="muted" mono style={{ width: 56 }}>
                    {cer.dayOffset == null ? "Daily" : `Day ${cer.dayOffset + 1}`}
                  </Text>
                  <Text variant="small" style={{ flex: 1 }}>
                    {cer.title}
                  </Text>
                </View>
              ))}
              <Text variant="caption" tone="muted">
                The standing ceremonies each cycle runs.
              </Text>
            </Card>
          </Section>
        ) : null}

        {cycles.length === 0 ? (
          <Empty icon="repeat" title="No cycles yet" body="A cycle is a fixed stretch — usually a week — of committed work. Plan the first one." action={<Button title="Plan a cycle" icon="plus" variant="brand" onPress={() => setAdding(true)} style={{ marginTop: space.sm }} />} />
        ) : (
          <>
            <CycleGroup title="Active" cycles={active} />
            <CycleGroup title="Upcoming" cycles={upcoming} />
            <CycleGroup title="Completed" cycles={done} />
          </>
        )}
      </Screen>
      <NewCycleSheet key={adding ? "open" : "closed"} visible={adding} onClose={() => setAdding(false)} projectId={id} after={last} />
    </>
  );
}

function CycleGroup({ title, cycles }: { title: string; cycles: CycleRow[] }) {
  const { space } = useTheme();
  if (!cycles.length) return null;
  return (
    <Section title={`${title} · ${cycles.length}`}>
      <View style={{ gap: space.sm }}>
        {cycles.map((c) => (
          <CycleCard key={c.id} cycle={c} />
        ))}
      </View>
    </Section>
  );
}

function VelocityCard({ velocity: v }: { velocity: Velocity }) {
  const { c } = useTheme();
  const recent = v.cycles.slice(-8);
  const max = Math.max(1, ...recent.map((x) => x.donePoints));
  return (
    <Section title="Velocity">
      <Card>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Stat value={String(v.averagePoints)} label="pts / cycle" />
          <Stat value={`${v.averageCompletionPct}%`} label="completed" />
          <Stat value={v.cyclesToClear == null ? "—" : String(v.cyclesToClear)} label="cycles to clear" />
        </View>
        <View accessibilityLabel={`Points finished in the last ${recent.length} cycles`} style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, height: 64, marginTop: 4 }}>
          {recent.map((x) => (
            <View key={x.id} style={{ flex: 1, alignItems: "center", gap: 2 }}>
              <Text variant="caption" tone="muted" mono>
                {x.donePoints}
              </Text>
              <View style={{ width: "100%", height: Math.max(2, (x.donePoints / max) * 40), backgroundColor: c.brand, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
            </View>
          ))}
        </View>
        <Text variant="caption" tone="muted">
          Points finished per completed cycle, averaged over the last six. Unestimated tasks count as one.
        </Text>
      </Card>
    </Section>
  );
}

function NewCycleSheet({ visible, onClose, projectId, after }: { visible: boolean; onClose: () => void; projectId: string; after?: CycleRow }) {
  const { space } = useTheme();
  // Default to the week after the latest cycle, or starting today.
  const start0 = after ? addDays(new Date(after.endDate), 1) : new Date();
  const [name, setName] = useState(after ? `Cycle ${after.number + 1}` : "Cycle 1");
  const [start, setStart] = useState(isoDay(start0));
  const [end, setEnd] = useState(isoDay(addDays(start0, 6)));
  const [saving, setSaving] = useState(false);
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const ok = !!name.trim() && re.test(start) && re.test(end) && end >= start;
  const save = async () => {
    setSaving(true);
    try {
      await createCycle({ projectId, name: name.trim(), startDate: start, endDate: end });
      onClose();
    } catch (e) {
      Alert.alert("Couldn't plan the cycle", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Plan a cycle">
      <View style={{ padding: space.lg, paddingTop: 0, gap: space.md }}>
        <Input label="Name" value={name} onChangeText={setName} />
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Input label="Starts" value={start} onChangeText={setStart} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Ends" value={end} onChangeText={setEnd} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
          </View>
        </View>
        {re.test(start) && re.test(end) && end < start ? (
          <Text variant="small" tone="danger">
            The end date has to be on or after the start.
          </Text>
        ) : null}
        <SheetActions onCancel={onClose} onSave={() => void save()} saveLabel="Plan cycle" saving={saving} disabled={!ok} />
      </View>
    </Sheet>
  );
}
