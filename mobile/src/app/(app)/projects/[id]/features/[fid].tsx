import { useQuery } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";

import { Markdown } from "@/components/markdown";
import { Avatar, Badge, Button, Card, Divider, ErrorView, Field, Input, Loading, Picker, Row, Screen, Section, Sheet, Text } from "@/components/ui";
import { IssueRow } from "@/features/issues/issue-row";
import { DatePicker } from "@/features/issues/pickers";
import { featureQuery, milestonesQuery, updateFeature, type FeatureDetail } from "@/features/projects/api";
import { ListCard, MarkdownEditor, MemberPicker, ProgressBar, SheetActions } from "@/features/projects/components";
import { FEATURE_STATUS_MAP, FEATURE_STATUSES } from "@/features/projects/constants";
import { shortDate } from "@/lib/format";
import { useTheme } from "@/theme";

type SheetName = "status" | "owner" | "milestone" | "start" | "target" | "title" | "spec" | null;

export default function FeatureScreen() {
  const { fid } = useLocalSearchParams<{ id: string; fid: string }>();
  const q = useQuery(featureQuery(fid));
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  return <FeatureBody f={q.data} refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />;
}

function FeatureBody({ f, refreshing, onRefresh }: { f: FeatureDetail; refreshing: boolean; onRefresh: () => void }) {
  const [sheet, setSheet] = useState<SheetName>(null);
  const close = () => setSheet(null);
  const milestones = useQuery({ ...milestonesQuery(f.projectId ?? ""), enabled: !!f.projectId }).data ?? [];
  const patch = (v: Record<string, unknown>) => void updateFeature(f.id, v).catch((e: Error) => Alert.alert("Couldn't save", e.message));
  const status = FEATURE_STATUS_MAP[f.status];

  return (
    <>
      <Stack.Screen options={{ title: f.project ? `${f.project.name} · Feature` : "Feature" }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <Text variant="heading" onPress={() => setSheet("title")}>
          {f.title}
        </Text>

        <Card style={{ paddingVertical: 4 }}>
          <Field label="Status" onPress={() => setSheet("status")}>
            <Badge label={status?.label ?? f.status} color={status?.color} dot />
          </Field>
          <Divider />
          <Field label="Owner" onPress={() => setSheet("owner")}>
            {f.owner ? (
              <>
                <Avatar name={f.owner.name} seed={f.owner.id} size={22} />
                <Text numberOfLines={1} style={{ flex: 1 }}>
                  {f.owner.name}
                </Text>
              </>
            ) : (
              <Text tone="muted">No owner</Text>
            )}
          </Field>
          <Divider />
          <Field label="Milestone" onPress={f.projectId ? () => setSheet("milestone") : undefined}>
            <Text numberOfLines={1}>{f.milestone?.name ?? "Unscheduled"}</Text>
          </Field>
          <Divider />
          <Field label="Start" onPress={() => setSheet("start")}>
            <Text>{f.startDate ? shortDate(f.startDate) : "—"}</Text>
          </Field>
          <Divider />
          <Field label="Target" onPress={() => setSheet("target")}>
            <Text>{f.targetDate ? shortDate(f.targetDate) : "—"}</Text>
          </Field>
          <Divider />
          <View style={{ paddingVertical: 10, gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text tone="muted">Progress</Text>
              <Text mono>
                {f.progress.done}/{f.progress.total} tasks · {f.progress.pct}%
              </Text>
            </View>
            <ProgressBar pct={f.progress.pct} color={status?.color} />
          </View>
        </Card>

        <Section title="Spec" action={<Button size="sm" variant="ghost" icon="edit-2" title={f.spec ? "Edit" : "Write"} onPress={() => setSheet("spec")} />}>
          {f.spec ? (
            <Card>
              <Markdown source={f.spec} />
            </Card>
          ) : (
            <Text tone="muted">No spec yet. Write the problem, the users it serves, and what done looks like.</Text>
          )}
        </Section>

        {f.page ? (
          <Section title="Linked doc">
            <ListCard>
              <Row leading={<Text>{f.page.icon || "📄"}</Text>} title={f.page.title || "Untitled"} chevron onPress={() => router.push(`/pages/${f.page!.id}`)} />
            </ListCard>
          </Section>
        ) : null}

        <Section title={`Tasks · ${f.issues.length}`}>
          {f.issues.length ? (
            <ListCard inset={48}>
              {f.issues.map((i) => (
                <IssueRow key={i.id} issue={i} />
              ))}
            </ListCard>
          ) : (
            <Text tone="muted">No tasks are linked to this feature yet. Link one from the web's task view.</Text>
          )}
        </Section>
      </Screen>

      <Picker
        title="Status"
        visible={sheet === "status"}
        onClose={close}
        value={f.status}
        options={FEATURE_STATUSES.map((s) => ({ value: s.id, label: s.label, leading: <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} /> }))}
        onPick={(v) => patch({ status: v })}
      />
      <MemberPicker title="Owner" noneLabel="No owner" visible={sheet === "owner"} onClose={close} value={f.owner?.id ?? null} onPick={(v) => patch({ ownerId: v })} />
      <Picker
        title="Milestone"
        visible={sheet === "milestone"}
        onClose={close}
        value={f.milestone?.id ?? "__none"}
        options={[{ value: "__none", label: "Unscheduled" }, ...milestones.map((m) => ({ value: m.id, label: m.name, subtitle: m.targetDate ? `Target ${shortDate(m.targetDate)}` : undefined }))]}
        onPick={(v) => patch({ milestoneId: v === "__none" ? null : v })}
      />
      <DatePicker title="Start date" visible={sheet === "start"} onClose={close} value={f.startDate?.slice(0, 10) ?? null} onPick={(v) => patch({ startDate: v })} />
      <DatePicker title="Target date" visible={sheet === "target"} onClose={close} value={f.targetDate?.slice(0, 10) ?? null} onPick={(v) => patch({ targetDate: v })} />
      <TitleSheet key={sheet === "title" ? "open" : "closed"} visible={sheet === "title"} onClose={close} initial={f.title} onSave={(title) => patch({ title })} />
      <MarkdownEditor title="Spec" visible={sheet === "spec"} initial={f.spec} onClose={close} onSave={(spec) => patch({ spec })} placeholder={"# Problem\n\n# Users\n\n# What done looks like"} />
    </>
  );
}

function TitleSheet({ visible, onClose, initial, onSave }: { visible: boolean; onClose: () => void; initial: string; onSave: (v: string) => void }) {
  const { space } = useTheme();
  const [title, setTitle] = useState(initial);
  return (
    <Sheet visible={visible} onClose={onClose} title="Rename feature">
      <View style={{ padding: space.lg, paddingTop: 0, gap: space.md }}>
        <Input value={title} onChangeText={setTitle} autoFocus />
        <SheetActions
          onCancel={onClose}
          disabled={!title.trim()}
          onSave={() => {
            onSave(title.trim());
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}
