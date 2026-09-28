import { useQuery } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { router, Stack, useLocalSearchParams, type Href } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";

import { Avatar, Button, Card, Divider, Empty, ErrorView, Field, Icon, IconButton, Input, Loading, Picker, Row, Screen, Section, Sheet, Text } from "@/components/ui";
import { setFavorite, setWatching } from "@/features/issues/attachments";
import { DatePicker } from "@/features/issues/pickers";
import { postStatusUpdate, projectQuery, updateProject, type ProjectDetail } from "@/features/projects/api";
import { Chips, ColorDot, HealthBadge, ListCard, MemberPicker, ProgressBar, SheetActions } from "@/features/projects/components";
import { DEPARTMENT_ICON, HEALTH, HEALTH_MAP, PROJECT_COLORS } from "@/features/projects/constants";
import { CycleCard } from "@/features/projects/cycle-card";
import { MILESTONE_STATUS_MAP } from "@/lib/constants";
import { ago, shortDate } from "@/lib/format";
import { useTheme } from "@/theme";

type SheetName = "owner" | "start" | "target" | "color" | "details" | "update" | null;

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery(projectQuery(id));
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  return <ProjectBody project={q.data} refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />;
}

function ProjectBody({ project: p, refreshing, onRefresh }: { project: ProjectDetail; refreshing: boolean; onRefresh: () => void }) {
  const { c, space } = useTheme();
  const [sheet, setSheet] = useState<SheetName>(null);
  const close = () => setSheet(null);
  const patch = (v: Record<string, unknown>) => void updateProject(p.id, v).catch((e: Error) => Alert.alert("Couldn't save", e.message));
  const go = (href: string) => router.push(href as Href);
  const isOp = p.kind === "operation";
  const ms = p.currentMilestone;

  return (
    <>
      <Stack.Screen
        options={{
          title: p.name,
          headerRight: () => (
            <View style={{ flexDirection: "row" }}>
              <IconButton icon="edit-2" label="Edit name and description" color={c.mutedForeground} onPress={() => setSheet("details")} />
              <IconButton icon={p.watching ? "bell" : "bell-off"} label={p.watching ? "Stop following status updates" : "Follow status updates"} color={p.watching ? c.brand : c.mutedForeground} onPress={() => void setWatching("project", p.id, !p.watching).catch((e: Error) => Alert.alert("Couldn't change that", e.message))} />
              <IconButton icon="star" label={p.favorite ? "Remove from favorites" : "Add to favorites"} color={p.favorite ? "#f5b400" : c.mutedForeground} onPress={() => void setFavorite("project", p.id, !p.favorite).catch((e: Error) => Alert.alert("Couldn't change that", e.message))} />
            </View>
          ),
        }}
      />
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <ColorDot color={p.color} size={14} />
            <Text variant="heading" style={{ flex: 1 }} onPress={() => setSheet("details")}>
              {p.name}
            </Text>
            <Text variant="small" tone="muted" mono>
              {p.key}
            </Text>
          </View>
          {p.tagline ? <Text tone="muted">{p.tagline}</Text> : null}
          {p.description ? <Text variant="small" tone="muted">{p.description}</Text> : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <HealthBadge health={p.health} />
            {isOp ? <Text variant="small" tone="muted">Operation</Text> : null}
            {p.confidential ? <Text variant="small" tone="muted">· Confidential</Text> : null}
            {p.url ? (
              <Text variant="small" tone="brand" onPress={() => void Linking.openURL(p.url!)} numberOfLines={1}>
                {p.url.replace(/^https?:\/\//, "")}
              </Text>
            ) : null}
          </View>
        </View>

        <Card style={{ paddingVertical: 4 }}>
          <Field label="Owner" onPress={p.canEditOwner ? () => setSheet("owner") : undefined}>
            {p.owner ? (
              <>
                <Avatar name={p.owner.name} seed={p.owner.id} size={22} />
                <Text numberOfLines={1} style={{ flex: 1 }}>
                  {p.owner.name}
                </Text>
              </>
            ) : (
              <Text tone="muted">No owner</Text>
            )}
          </Field>
          <Divider />
          <Field label="Start" onPress={() => setSheet("start")}>
            <Text>{p.startDate ? shortDate(p.startDate) : "—"}</Text>
          </Field>
          <Divider />
          <Field label="Target" onPress={() => setSheet("target")}>
            <Text>{p.targetDate ? shortDate(p.targetDate) : "—"}</Text>
          </Field>
          <Divider />
          <Field label="Colour" onPress={() => setSheet("color")}>
            <ColorDot color={p.color} size={14} />
            <Text mono tone="muted">
              {p.color}
            </Text>
          </Field>
          <Divider />
          <View style={{ paddingVertical: 10, gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text tone="muted">Progress</Text>
              <Text mono>
                {p.progress.done}/{p.progress.total} · {p.progress.pct}%
              </Text>
            </View>
            <ProgressBar pct={p.progress.pct} color={p.color} />
          </View>
        </Card>

        {!isOp ? (
          <Section title="Now">
            {ms ? (
              <Card onPress={() => go(`/projects/${p.id}/milestones/${ms.id}`)}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Icon name="flag" size={16} color={MILESTONE_STATUS_MAP[ms.status]?.color ?? c.mutedForeground} />
                  <Text weight="600" numberOfLines={1} style={{ flex: 1 }}>
                    {ms.name}
                  </Text>
                  <Text variant="small" tone="muted">
                    {MILESTONE_STATUS_MAP[ms.status]?.label ?? ms.status}
                  </Text>
                </View>
                <Text variant="small" tone="muted">
                  {ms.targetDate ? `Target ${shortDate(ms.targetDate)}` : "No target date"} · {ms.progress.done}/{ms.progress.total} tasks
                </Text>
                <ProgressBar pct={ms.progress.pct} color={MILESTONE_STATUS_MAP[ms.status]?.color} />
              </Card>
            ) : (
              <Text tone="muted">No milestones yet. Add one from Product → Roadmap.</Text>
            )}
            {p.activeCycle ? <CycleCard cycle={p.activeCycle} /> : null}
          </Section>
        ) : null}

        {p.visibleDepartments.length ? (
          <Section title="Departments">
            <ListCard inset={52}>
              {p.visibleDepartments.map((d) => (
                <Row key={d.slug} leading={<Icon name={DEPARTMENT_ICON[d.slug] ?? "grid"} color={d.color} />} title={d.label} subtitle={d.stat || undefined} chevron onPress={() => go(`/projects/${p.id}/${d.slug}`)} />
              ))}
            </ListCard>
          </Section>
        ) : null}

        <Section title={isOp ? "Work" : "Planning"}>
          <ListCard inset={52}>
            <Row leading={<Icon name="list" color={c.mutedForeground} />} title="Tasks" subtitle={isOp ? "Everything in this operation" : "Every task in the project"} chevron onPress={() => go(`/projects/${p.id}/tasks`)} />
            {!isOp ? <Row leading={<Icon name="repeat" color={c.mutedForeground} />} title="Cycles" subtitle="Cadence, velocity and every sprint" chevron onPress={() => go(`/projects/${p.id}/cycles`)} /> : null}
            <Row leading={<Icon name="file-text" color={c.mutedForeground} />} title="Docs" subtitle="The project's pages" chevron onPress={() => go(`/projects/${p.id}/docs`)} />
          </ListCard>
        </Section>

        <Section title="Status updates" action={<Button size="sm" variant="ghost" icon="plus" title="Post update" onPress={() => setSheet("update")} />}>
          {p.statusUpdates.length ? (
            <View style={{ gap: space.sm }}>
              {p.statusUpdates.map((u) => (
                <Card key={u.id} style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <HealthBadge health={u.health} />
                    <Text variant="small" tone="muted" style={{ flex: 1 }} numberOfLines={1}>
                      {u.author?.name ?? "Someone"}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {ago(u.createdAt)}
                    </Text>
                  </View>
                  {u.body ? <Text>{u.body}</Text> : null}
                </Card>
              ))}
            </View>
          ) : (
            <Empty icon="activity" title="No status updates yet" body="Say how the project is going: on track, at risk or off track." />
          )}
        </Section>
      </Screen>

      <MemberPicker title="Owner" noneLabel="No owner" visible={sheet === "owner"} onClose={close} value={p.ownerId} onPick={(v) => patch({ ownerId: v })} />
      <DatePicker title="Start date" visible={sheet === "start"} onClose={close} value={p.startDate?.slice(0, 10) ?? null} onPick={(v) => patch({ startDate: v })} />
      <DatePicker title="Target date" visible={sheet === "target"} onClose={close} value={p.targetDate?.slice(0, 10) ?? null} onPick={(v) => patch({ targetDate: v })} />
      <Picker
        title="Colour"
        visible={sheet === "color"}
        onClose={close}
        value={p.color}
        options={PROJECT_COLORS.map((col) => ({ value: col, label: col, leading: <ColorDot color={col} size={18} /> }))}
        onPick={(v) => patch({ color: v })}
      />
      <DetailsSheet key={sheet === "details" ? "open" : "closed"} visible={sheet === "details"} onClose={close} project={p} onSave={patch} />
      <StatusUpdateSheet visible={sheet === "update"} onClose={close} projectId={p.id} />
    </>
  );
}

function DetailsSheet({ visible, onClose, project, onSave }: { visible: boolean; onClose: () => void; project: ProjectDetail; onSave: (v: Record<string, unknown>) => void }) {
  const { space } = useTheme();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  return (
    <Sheet visible={visible} onClose={onClose} title="Project details">
      <View style={{ padding: space.lg, paddingTop: 0, gap: space.md }}>
        <Input label="Name" value={name} onChangeText={setName} />
        <Input label="Description" value={description} onChangeText={setDescription} multiline placeholder="What this project is for" />
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

function StatusUpdateSheet({ visible, onClose, projectId }: { visible: boolean; onClose: () => void; projectId: string }) {
  const { space } = useTheme();
  const [health, setHealth] = useState<string>("on_track");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await postStatusUpdate(projectId, health, body.trim());
      setBody("");
      onClose();
    } catch (e) {
      Alert.alert("Couldn't post the update", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Post a status update">
      <View style={{ padding: space.lg, paddingTop: 0, gap: space.md }}>
        <Chips value={health} onChange={setHealth} options={HEALTH.map((h) => ({ id: h.id, label: h.label, color: h.color }))} />
        <Input value={body} onChangeText={setBody} multiline placeholder="What changed, what's blocked, what's next" />
        <Text variant="caption" tone="muted">
          Everyone following this project is notified. Posting also makes you a follower.
        </Text>
        <SheetActions onCancel={onClose} onSave={() => void save()} saveLabel={`Post ${HEALTH_MAP[health]?.label.toLowerCase() ?? ""} update`} saving={saving} />
      </View>
    </Sheet>
  );
}
