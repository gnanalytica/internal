import { useQuery } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";

import { Markdown } from "@/components/markdown";
import { Badge, Button, Card, Divider, ErrorView, Field, Icon, Input, Loading, Picker, Row, Screen, Section, Sheet, Text } from "@/components/ui";
import { IssueRow } from "@/features/issues/issue-row";
import { DatePicker } from "@/features/issues/pickers";
import { milestoneQuery, updateMilestone, type MilestoneDetail } from "@/features/projects/api";
import { ListCard, ProgressBar, SheetActions } from "@/features/projects/components";
import { FEATURE_STATUS_MAP } from "@/features/projects/constants";
import { NewFeatureSheet } from "@/features/projects/sheets";
import { MILESTONE_STATUS_MAP, MILESTONE_STATUSES } from "@/lib/constants";
import { dueLabel, shortDate } from "@/lib/format";
import { useTheme } from "@/theme";

export default function MilestoneScreen() {
  const { mid } = useLocalSearchParams<{ id: string; mid: string }>();
  const q = useQuery(milestoneQuery(mid));
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  return <MilestoneBody m={q.data} refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />;
}

function MilestoneBody({ m, refreshing, onRefresh }: { m: MilestoneDetail; refreshing: boolean; onRefresh: () => void }) {
  const { c, space } = useTheme();
  const [sheet, setSheet] = useState<"status" | "date" | "edit" | "feature" | null>(null);
  const close = () => setSheet(null);
  const patch = (v: Record<string, unknown>) => void updateMilestone(m.id, m.projectId, v).catch((e: Error) => Alert.alert("Couldn't save", e.message));
  const status = MILESTONE_STATUS_MAP[m.status];
  const due = m.status === "achieved" || m.status === "missed" ? null : dueLabel(m.targetDate);

  return (
    <>
      <Stack.Screen options={{ title: m.project ? `${m.project.name} · Milestone` : "Milestone" }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="flag" size={18} color={status?.color} />
            <Text variant="heading" style={{ flex: 1 }} onPress={() => setSheet("edit")}>
              {m.name}
            </Text>
          </View>
          {m.description ? <Markdown source={m.description} compact /> : <Text tone="muted" onPress={() => setSheet("edit")}>Add a description of what passing this gate means.</Text>}
        </View>

        <Card style={{ paddingVertical: 4 }}>
          <Field label="Status" onPress={() => setSheet("status")}>
            <Badge label={status?.label ?? m.status} color={status?.color} dot />
          </Field>
          <Divider />
          <Field label="Target" onPress={() => setSheet("date")}>
            <Text style={{ color: due?.late ? c.destructive : c.foreground }}>{m.targetDate ? `${shortDate(m.targetDate)}${due ? ` · ${due.text}` : ""}` : "—"}</Text>
          </Field>
          <Divider />
          <View style={{ paddingVertical: 10, gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text tone="muted">Progress</Text>
              <Text mono>
                {m.progress.done}/{m.progress.total} tasks · {m.progress.pct}%
              </Text>
            </View>
            <ProgressBar pct={m.progress.pct} color={status?.color} />
          </View>
        </Card>

        <Section title={`Features · ${m.features.length}`} action={<Button size="sm" variant="ghost" icon="plus" title="Feature" onPress={() => setSheet("feature")} />}>
          {m.features.length ? (
            <ListCard inset={48}>
              {m.features.map((f) => (
                <Row
                  key={f.id}
                  leading={<View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: FEATURE_STATUS_MAP[f.status]?.color ?? c.mutedForeground }} />}
                  title={f.title}
                  subtitle={`${FEATURE_STATUS_MAP[f.status]?.label ?? f.status}${f.owner ? ` · ${f.owner.name}` : ""}${f.progress.total ? ` · ${f.progress.done}/${f.progress.total} tasks` : ""}`}
                  chevron
                  onPress={() => router.push(`/projects/${m.projectId}/features/${f.id}`)}
                />
              ))}
            </ListCard>
          ) : (
            <Text tone="muted">No features on this milestone yet.</Text>
          )}
        </Section>

        <Section title={`Tasks · ${m.issues.length}`}>
          {m.issues.length ? (
            <ListCard inset={48}>
              {m.issues.map((i) => (
                <IssueRow key={i.id} issue={i} />
              ))}
            </ListCard>
          ) : (
            <Text tone="muted">No tasks attached straight to this milestone. Tasks under its features count towards its progress.</Text>
          )}
        </Section>
      </Screen>

      <Picker
        title="Status"
        visible={sheet === "status"}
        onClose={close}
        value={m.status}
        options={MILESTONE_STATUSES.map((s) => ({ value: s.id, label: s.label, leading: <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} /> }))}
        onPick={(v) => patch({ status: v })}
      />
      <DatePicker title="Target date" visible={sheet === "date"} onClose={close} value={m.targetDate?.slice(0, 10) ?? null} onPick={(v) => patch({ targetDate: v })} />
      <EditSheet key={sheet === "edit" ? "open" : "closed"} visible={sheet === "edit"} onClose={close} m={m} onSave={patch} />
      <NewFeatureSheet visible={sheet === "feature"} onClose={close} projectId={m.projectId} milestoneId={m.id} />
    </>
  );
}

function EditSheet({ visible, onClose, m, onSave }: { visible: boolean; onClose: () => void; m: MilestoneDetail; onSave: (v: Record<string, unknown>) => void }) {
  const { space } = useTheme();
  const [name, setName] = useState(m.name);
  const [description, setDescription] = useState(m.description ?? "");
  return (
    <Sheet visible={visible} onClose={onClose} title="Edit milestone">
      <View style={{ padding: space.lg, paddingTop: 0, gap: space.md }}>
        <Input label="Name" value={name} onChangeText={setName} />
        <Input label="Description" value={description} onChangeText={setDescription} multiline placeholder="What has to be true to pass this gate" />
        <SheetActions
          onCancel={onClose}
          disabled={!name.trim()}
          onSave={() => {
            onSave({ name: name.trim(), description: description.trim() || null });
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}
