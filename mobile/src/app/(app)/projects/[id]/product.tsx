import { useQuery } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";

import { Badge, Button, Card, Empty, ErrorView, Fab, Icon, Input, Loading, Picker, Row, Screen, Section, Segmented, Sheet, Text } from "@/components/ui";
import { IssueList } from "@/features/issues/issue-list";
import { createFeedback, createMilestone, feedbackQuery, featuresQuery, milestonesQuery, projectQuery, updateFeedback, type Feedback, type Milestone } from "@/features/projects/api";
import { Chips, ListCard, ProgressBar, SheetActions } from "@/features/projects/components";
import { NewFeatureSheet } from "@/features/projects/sheets";
import { FEATURE_STATUS_MAP, FEEDBACK_SOURCE_MAP, FEEDBACK_SOURCES, FEEDBACK_STATUS_MAP, FEEDBACK_STATUSES } from "@/features/projects/constants";
import { MILESTONE_STATUS_MAP } from "@/lib/constants";
import { ago, shortDate } from "@/lib/format";
import { useTheme } from "@/theme";

type Tab = "roadmap" | "tasks" | "feedback";

/** Product: the roadmap of milestones, the product tasks, and the feedback that feeds them. */
export default function ProductScreen() {
  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: Tab }>();
  const { space } = useTheme();
  const project = useQuery(projectQuery(id)).data;
  const [tab, setTab] = useState<Tab>(initialTab ?? "roadmap");
  const tabs = (
    <Segmented<Tab>
      value={tab}
      onChange={setTab}
      options={[
        { value: "roadmap", label: "Roadmap" },
        { value: "tasks", label: "Tasks" },
        { value: "feedback", label: "Feedback" },
      ]}
    />
  );
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: project ? `${project.name} · Product` : "Product" }} />
      {tab === "tasks" ? (
        <>
          <IssueList filters={{ project: id, type: "product" }} hideDone header={<View style={{ padding: space.lg, paddingBottom: space.sm }}>{tabs}</View>} emptyTitle="No open product tasks" emptyBody="Tasks of type Product / Design in this project show here." />
          <Fab label="New task" onPress={() => router.push({ pathname: "/issues/new", params: { project: id } })} />
        </>
      ) : tab === "roadmap" ? (
        <Roadmap projectId={id} tabs={tabs} />
      ) : (
        <FeedbackTab projectId={id} tabs={tabs} />
      )}
    </View>
  );
}

function Roadmap({ projectId, tabs }: { projectId: string; tabs: React.ReactNode }) {
  const { c, space } = useTheme();
  const ms = useQuery(milestonesQuery(projectId));
  const feats = useQuery(featuresQuery(projectId));
  const [adding, setAdding] = useState<"milestone" | "feature" | null>(null);
  const unscheduled = (feats.data ?? []).filter((f) => !f.milestone && f.status !== "archived");

  return (
    <>
      <Screen refreshing={ms.isRefetching || feats.isRefetching} onRefresh={() => void Promise.all([ms.refetch(), feats.refetch()])}>
        {tabs}
        {ms.isPending ? (
          <Loading />
        ) : ms.isError ? (
          <ErrorView error={ms.error} onRetry={() => void ms.refetch()} />
        ) : (
          <Section title="Milestones" action={<Button size="sm" variant="ghost" icon="plus" title="Milestone" onPress={() => setAdding("milestone")} />}>
            {ms.data.length ? (
              <View style={{ gap: space.sm }}>
                {ms.data.map((m) => (
                  <MilestoneCard key={m.id} milestone={m} />
                ))}
              </View>
            ) : (
              <Empty icon="flag" title="No milestones yet" body="Milestones are the gates a release passes through. Add the first one." />
            )}
          </Section>
        )}
        <Section title="Unscheduled features" action={<Button size="sm" variant="ghost" icon="plus" title="Feature" onPress={() => setAdding("feature")} />}>
          {feats.isError ? (
            <ErrorView error={feats.error} onRetry={() => void feats.refetch()} />
          ) : unscheduled.length ? (
            <ListCard inset={48}>
              {unscheduled.map((f) => (
                <Row
                  key={f.id}
                  leading={<View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: FEATURE_STATUS_MAP[f.status]?.color ?? c.mutedForeground }} />}
                  title={f.title}
                  subtitle={`${FEATURE_STATUS_MAP[f.status]?.label ?? f.status}${f.progress.total ? ` · ${f.progress.done}/${f.progress.total} tasks` : ""}`}
                  chevron
                  onPress={() => router.push(`/projects/${projectId}/features/${f.id}`)}
                />
              ))}
            </ListCard>
          ) : (
            <Text tone="muted">{feats.isPending ? "Loading…" : "Every feature is on a milestone."}</Text>
          )}
        </Section>
      </Screen>
      <NewMilestoneSheet visible={adding === "milestone"} onClose={() => setAdding(null)} projectId={projectId} />
      <NewFeatureSheet visible={adding === "feature"} onClose={() => setAdding(null)} projectId={projectId} milestoneId={null} />
    </>
  );
}

function MilestoneCard({ milestone: m }: { milestone: Milestone }) {
  const status = MILESTONE_STATUS_MAP[m.status];
  return (
    <Card onPress={() => router.push(`/projects/${m.projectId}/milestones/${m.id}`)}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon name="flag" size={15} color={status?.color} />
        <Text weight="600" numberOfLines={1} style={{ flex: 1 }}>
          {m.name}
        </Text>
        <Badge label={status?.label ?? m.status} color={status?.color} dot />
      </View>
      <Text variant="small" tone="muted">
        {m.targetDate ? `Target ${shortDate(m.targetDate)}` : "No target date"} · {m.featureCount} feature{m.featureCount === 1 ? "" : "s"} · {m.progress.done}/{m.progress.total} tasks
      </Text>
      <ProgressBar pct={m.progress.pct} color={status?.color} />
    </Card>
  );
}

function FeedbackTab({ projectId, tabs }: { projectId: string; tabs: React.ReactNode }) {
  const { space } = useTheme();
  const q = useQuery(feedbackQuery(projectId));
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Feedback | null>(null);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const items = (q.data ?? []).filter((f) => filter === "all" || ["new", "reviewing", "planned"].includes(f.status));
  return (
    <>
      <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
        {tabs}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Chips
            value={filter}
            onChange={setFilter}
            options={[
              { id: "open", label: "Open" },
              { id: "all", label: "All" },
            ]}
          />
          <Button size="sm" variant="ghost" icon="plus" title="Feedback" onPress={() => setAdding(true)} />
        </View>
        {q.isPending ? (
          <Loading />
        ) : q.isError ? (
          <ErrorView error={q.error} onRetry={() => void q.refetch()} />
        ) : items.length ? (
          <View style={{ gap: space.sm }}>
            {items.map((f) => (
              <Card key={f.id} onPress={() => setEditing(f)}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                  <View style={{ alignItems: "center", minWidth: 28 }}>
                    <Icon name="chevron-up" size={16} />
                    <Text weight="700" mono>
                      {f.votes}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text weight="600">{f.title}</Text>
                    {f.body ? (
                      <Text variant="small" tone="muted" numberOfLines={3}>
                        {f.body}
                      </Text>
                    ) : null}
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                      <Badge label={FEEDBACK_STATUS_MAP[f.status]?.label ?? f.status} color={FEEDBACK_STATUS_MAP[f.status]?.color} dot />
                      <Badge label={FEEDBACK_SOURCE_MAP[f.source]?.label ?? f.source} />
                      <Text variant="caption" tone="muted">
                        {f.contact ? `${f.contact} · ` : ""}
                        {ago(f.createdAt)}
                      </Text>
                    </View>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        ) : (
          <Empty icon="message-square" title={filter === "open" ? "No open feedback" : "No feedback yet"} body="Capture requests from customers, sales calls and interviews here." />
        )}
      </Screen>
      <NewFeedbackSheet visible={adding} onClose={() => setAdding(false)} projectId={projectId} />
      <FeedbackActions item={editing} onClose={() => setEditing(null)} projectId={projectId} />
    </>
  );
}

function FeedbackActions({ item, onClose, projectId }: { item: Feedback | null; onClose: () => void; projectId: string }) {
  const [picking, setPicking] = useState(false);
  const { space } = useTheme();
  if (!item) return null;
  const patch = (v: Record<string, unknown>) => void updateFeedback(item.id, projectId, v).catch((e: Error) => Alert.alert("Couldn't save", e.message));
  return (
    <>
      <Sheet visible={!picking} onClose={onClose} title={item.title}>
        <View style={{ padding: space.lg, paddingTop: 0, gap: space.md }}>
          {item.body ? <Text>{item.body}</Text> : null}
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Button
              title={`Upvote (${item.votes})`}
              icon="chevron-up"
              style={{ flex: 1 }}
              onPress={() => {
                patch({ votes: item.votes + 1 });
                onClose();
              }}
            />
            <Button title={FEEDBACK_STATUS_MAP[item.status]?.label ?? "Status"} icon="circle" style={{ flex: 1 }} onPress={() => setPicking(true)} />
          </View>
        </View>
      </Sheet>
      <Picker
        title="Status"
        visible={picking}
        onClose={() => {
          setPicking(false);
          onClose();
        }}
        value={item.status}
        options={FEEDBACK_STATUSES.map((s) => ({ value: s.id, label: s.label, leading: <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} /> }))}
        onPick={(v) => patch({ status: v })}
      />
    </>
  );
}

function NewMilestoneSheet({ visible, onClose, projectId }: { visible: boolean; onClose: () => void; projectId: string }) {
  const { space } = useTheme();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const validDate = !date || /^\d{4}-\d{2}-\d{2}$/.test(date);
  const save = async () => {
    setSaving(true);
    try {
      await createMilestone({ projectId, name: name.trim(), targetDate: date || null });
      setName("");
      setDate("");
      onClose();
    } catch (e) {
      Alert.alert("Couldn't add the milestone", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="New milestone">
      <View style={{ padding: space.lg, paddingTop: 0, gap: space.md }}>
        <Input label="Name" placeholder="e.g. Private beta" value={name} onChangeText={setName} autoFocus />
        <Input label="Target date" placeholder="yyyy-mm-dd (optional)" value={date} onChangeText={setDate} autoCapitalize="none" keyboardType="numbers-and-punctuation" hint={validDate ? undefined : "Use the form 2026-10-31."} />
        <SheetActions onCancel={onClose} onSave={() => void save()} saveLabel="Add milestone" saving={saving} disabled={!name.trim() || !validDate} />
      </View>
    </Sheet>
  );
}

function NewFeedbackSheet({ visible, onClose, projectId }: { visible: boolean; onClose: () => void; projectId: string }) {
  const { space } = useTheme();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [contact, setContact] = useState("");
  const [source, setSource] = useState<string>("customer");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await createFeedback({ projectId, title: title.trim(), body: body.trim() || undefined, contact: contact.trim() || undefined, source });
      setTitle("");
      setBody("");
      setContact("");
      onClose();
    } catch (e) {
      Alert.alert("Couldn't add the feedback", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="New feedback">
      <View style={{ padding: space.lg, paddingTop: 0, gap: space.md }}>
        <Input label="What they asked for" placeholder="e.g. Export valuations to Excel" value={title} onChangeText={setTitle} autoFocus />
        <Input label="Details" value={body} onChangeText={setBody} multiline placeholder="Their words, the context, why it matters" />
        <Input label="From" value={contact} onChangeText={setContact} placeholder="Who, or where it came from (optional)" />
        <Chips value={source} onChange={setSource} options={FEEDBACK_SOURCES.map((s) => ({ id: s.id, label: s.label }))} />
        <SheetActions onCancel={onClose} onSave={() => void save()} saveLabel="Add feedback" saving={saving} disabled={!title.trim()} />
      </View>
    </Sheet>
  );
}
