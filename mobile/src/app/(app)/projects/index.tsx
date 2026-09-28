import { useQuery } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { Avatar, Button, Card, Empty, ErrorView, IconButton, Input, Loading, Screen, Section, Segmented, Sheet, Text } from "@/components/ui";
import { createProject, summariesQuery, type ProjectSummary } from "@/features/projects/api";
import { Chips, ColorDot, HealthBadge, ListCard, ProgressBar, SheetActions } from "@/features/projects/components";
import { CycleCard } from "@/features/projects/cycle-card";
import { ProjectTimeline } from "@/features/projects/timeline";
import { shortDate } from "@/lib/format";
import { useTheme } from "@/theme";

type Tab = "list" | "timeline" | "week";

/** Projects: the web's List / Timeline / This week tabs. */
export default function Projects() {
  const { space } = useTheme();
  const q = useQuery(summariesQuery);
  const [view, setView] = useState<Tab>("list");
  const [creating, setCreating] = useState(false);

  const header = (
    <Stack.Screen options={{ title: "Projects", headerRight: () => <IconButton icon="plus" label="New project" onPress={() => setCreating(true)} /> }} />
  );
  if (q.isPending) return (<>{header}<Loading /></>);
  if (q.isError) return (<>{header}<ErrorView error={q.error} onRetry={() => void q.refetch()} /></>);

  const projects = q.data.filter((p) => p.kind === "project");
  const ops = q.data.filter((p) => p.kind === "operation");

  return (
    <>
      {header}
      <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
        <Segmented<Tab>
          value={view}
          onChange={setView}
          options={[
            { value: "list", label: "List" },
            { value: "timeline", label: "Timeline" },
            { value: "week", label: "This week" },
          ]}
        />
        {view === "list" ? (
          q.data.length === 0 ? (
            <Empty icon="folder" title="No projects yet" body="Create a project to track work across its departments." action={<Button title="New project" icon="plus" variant="brand" onPress={() => setCreating(true)} style={{ marginTop: space.sm }} />} />
          ) : (
            <>
              {projects.length ? (
                <Section title="Projects">
                  <View style={{ gap: space.md }}>
                    {projects.map((p) => (
                      <ProjectCard key={p.id} project={p} />
                    ))}
                  </View>
                </Section>
              ) : null}
              {ops.length ? (
                <Section title="Operations">
                  <ListCard>
                    {ops.map((p) => (
                      <OperationRow key={p.id} project={p} />
                    ))}
                  </ListCard>
                </Section>
              ) : null}
            </>
          )
        ) : view === "timeline" ? (
          <ProjectTimeline projects={projects} />
        ) : (
          <ThisWeek projects={projects} />
        )}
      </Screen>
      <NewProjectSheet visible={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function ProjectCard({ project: p }: { project: ProjectSummary }) {
  const { space } = useTheme();
  const ms = p.currentMilestone;
  return (
    <Card onPress={() => router.push(`/projects/${p.id}`)}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <ColorDot color={p.color} size={12} />
        <Text variant="title" numberOfLines={1} style={{ flex: 1 }}>
          {p.name}
        </Text>
        <Text variant="caption" tone="muted" mono>
          {p.key}
        </Text>
      </View>
      {p.tagline || p.description ? (
        <Text variant="small" tone="muted" numberOfLines={2}>
          {p.tagline || p.description}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" }}>
        <HealthBadge health={p.health} />
        {ms ? (
          <Text variant="small" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
            {`◆ ${ms.name}${ms.targetDate ? ` · ${shortDate(ms.targetDate)}` : ""}`}
          </Text>
        ) : null}
      </View>
      <ProgressBar pct={p.progress.pct} color={p.color} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text variant="small" tone="muted" mono style={{ flex: 1 }}>
          {p.progress.done}/{p.progress.total} done · {p.openIssues} open
        </Text>
        {p.owner ? (
          <>
            <Avatar name={p.owner.name} seed={p.owner.id} size={20} />
            <Text variant="small" tone="muted" numberOfLines={1}>
              {p.owner.name.split(" ")[0]}
            </Text>
          </>
        ) : (
          <Text variant="small" tone="muted">
            No owner
          </Text>
        )}
      </View>
    </Card>
  );
}

function OperationRow({ project: p }: { project: ProjectSummary }) {
  const { c, space } = useTheme();
  return (
    <Pressable onPress={() => router.push(`/projects/${p.id}`)} style={({ pressed }) => ({ padding: space.md, paddingHorizontal: space.lg, gap: 6, backgroundColor: pressed ? c.muted : c.card })}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <ColorDot color={p.color} />
        <Text weight="500" numberOfLines={1} style={{ flex: 1 }}>
          {p.name}
        </Text>
        <Text variant="caption" tone="muted" mono>
          {p.progress.done}/{p.progress.total}
        </Text>
      </View>
      {p.description ? (
        <Text variant="small" tone="muted" numberOfLines={1}>
          {p.description}
        </Text>
      ) : null}
      <ProgressBar pct={p.progress.pct} height={4} />
    </Pressable>
  );
}

function ThisWeek({ projects }: { projects: ProjectSummary[] }) {
  const { space } = useTheme();
  const running = projects.filter((p) => p.activeCycle);
  const idle = projects.filter((p) => !p.activeCycle);
  if (projects.length === 0) return <Empty icon="repeat" title="No projects yet" body="Each project's running cycle shows here." />;
  return (
    <>
      {running.length ? (
        <View style={{ gap: space.md }}>
          {running.map((p) => (
            <CycleCard key={p.id} cycle={p.activeCycle!} showProject />
          ))}
        </View>
      ) : (
        <Empty icon="repeat" title="No cycles running" body="None of your projects has a cycle this week. Plan one from a project's Cycles." />
      )}
      {idle.length ? (
        <Section title="No cycle this week">
          <ListCard>
            {idle.map((p) => (
              <Pressable key={p.id} onPress={() => router.push(`/projects/${p.id}/cycles`)} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: space.md, paddingHorizontal: space.lg }}>
                <ColorDot color={p.color} />
                <Text numberOfLines={1} style={{ flex: 1 }}>
                  {p.name}
                </Text>
                <Text variant="small" tone="brand">
                  Plan a cycle
                </Text>
              </Pressable>
            ))}
          </ListCard>
        </Section>
      ) : null}
    </>
  );
}

function NewProjectSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { space } = useTheme();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"project" | "operation">("project");
  const [saving, setSaving] = useState(false);
  const close = () => {
    setName("");
    setKind("project");
    onClose();
  };
  const save = async () => {
    setSaving(true);
    try {
      const p = await createProject({ name: name.trim(), kind });
      close();
      router.push(`/projects/${p.id}`);
    } catch (e) {
      Alert.alert("Couldn't create the project", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={close} title="New project">
      <View style={{ padding: space.lg, paddingTop: 0, gap: space.md }}>
        <Input label="Name" placeholder="e.g. Valytica" value={name} onChangeText={setName} autoFocus />
        <View style={{ gap: 6 }}>
          <Text variant="small" tone="muted" weight="500">
            Kind
          </Text>
          <Chips
            value={kind}
            onChange={setKind}
            options={[
              { id: "project", label: "Project" },
              { id: "operation", label: "Operation" },
            ]}
          />
          <Text variant="caption" tone="muted">
            {kind === "project" ? "An app you ship. Gets departments, cycles and a roadmap." : "Internal or back-office work. Just tasks and docs."}
          </Text>
        </View>
        <SheetActions onCancel={close} onSave={() => void save()} saveLabel="Create" saving={saving} disabled={!name.trim()} />
      </View>
    </Sheet>
  );
}
