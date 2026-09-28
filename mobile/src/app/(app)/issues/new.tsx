import { useQuery } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";

import { Avatar, Button, Card, Divider, Field, Input, PriorityIcon, Screen, StatusIcon, Text } from "@/components/ui";
import { createIssue } from "@/features/issues/api";
import { AssigneesPicker, DatePicker, PriorityPicker, ProjectPicker, StatusPicker, TypePicker } from "@/features/issues/pickers";
import { membersQuery, projectsQuery } from "@/features/workspace/api";
import { useMe } from "@/lib/auth";
import { ISSUE_TYPE_MAP, PRIORITY_MAP, STATUS_MAP } from "@/lib/constants";
import { shortDate } from "@/lib/format";
import { useTheme } from "@/theme";

export default function NewIssue() {
  const params = useLocalSearchParams<{ project?: string; parent?: string }>();
  const me = useMe();
  const { c } = useTheme();
  const members = useQuery(membersQuery).data ?? [];
  const projects = useQuery(projectsQuery).data ?? [];
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("none");
  const [type, setType] = useState("engineering");
  const [projectId, setProjectId] = useState<string | null>(params.project || null);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(me.actor ? [me.actor.id] : []);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const issue = await createIssue({ title: title.trim(), description: description.trim() || undefined, status, priority, type, projectId, assigneeIds, dueDate, parentId: params.parent || undefined });
      router.replace(`/issues/${issue.id}`);
    } catch (e) {
      Alert.alert("Couldn't create the issue", (e as Error).message);
      setSaving(false);
    }
  };

  const people = members.filter((m) => assigneeIds.includes(m.id));
  return (
    <>
      <Stack.Screen options={{ title: params.parent ? "New sub-issue" : "New issue", presentation: "modal", headerRight: () => <Button title="Create" size="sm" variant="brand" loading={saving} disabled={!title.trim()} onPress={() => void save()} /> }} />
      <Screen>
        <Input placeholder="Issue title" value={title} onChangeText={setTitle} autoFocus style={{ fontSize: 18, fontWeight: "600" }} />
        <Input placeholder="Add a description (Markdown)…" value={description} onChangeText={setDescription} multiline />
        <Card style={{ paddingVertical: 4 }}>
          <Field label="Status" onPress={() => setSheet("status")}>
            <StatusIcon status={status} />
            <Text>{STATUS_MAP[status].label}</Text>
          </Field>
          <Divider />
          <Field label="Priority" onPress={() => setSheet("priority")}>
            <PriorityIcon priority={priority} />
            <Text>{PRIORITY_MAP[priority].label}</Text>
          </Field>
          <Divider />
          <Field label="Assignees" onPress={() => setSheet("assignees")}>
            {people.length ? (
              <>
                {people.slice(0, 3).map((p) => (
                  <Avatar key={p.id} name={p.name} seed={p.id} size={22} />
                ))}
                <Text numberOfLines={1} style={{ flex: 1 }}>
                  {people.map((p) => p.name.split(" ")[0]).join(", ")}
                </Text>
              </>
            ) : (
              <Text tone="muted">Unassigned</Text>
            )}
          </Field>
          <Divider />
          <Field label="Type" onPress={() => setSheet("type")}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: ISSUE_TYPE_MAP[type]?.color ?? c.mutedForeground }} />
            <Text>{ISSUE_TYPE_MAP[type]?.label}</Text>
          </Field>
          <Divider />
          <Field label="Project" onPress={() => setSheet("project")}>
            <Text>{projects.find((p) => p.id === projectId)?.name ?? "No project"}</Text>
          </Field>
          <Divider />
          <Field label="Due" onPress={() => setSheet("due")}>
            <Text>{dueDate ? shortDate(dueDate) : "—"}</Text>
          </Field>
        </Card>
      </Screen>
      <StatusPicker visible={sheet === "status"} onClose={() => setSheet(null)} value={status} onPick={setStatus} />
      <PriorityPicker visible={sheet === "priority"} onClose={() => setSheet(null)} value={priority} onPick={setPriority} />
      <TypePicker visible={sheet === "type"} onClose={() => setSheet(null)} value={type} onPick={setType} />
      <ProjectPicker visible={sheet === "project"} onClose={() => setSheet(null)} value={projectId} onPick={setProjectId} />
      <AssigneesPicker visible={sheet === "assignees"} onClose={() => setSheet(null)} value={assigneeIds} onPick={setAssigneeIds} />
      <DatePicker title="Due date" visible={sheet === "due"} onClose={() => setSheet(null)} value={dueDate} onPick={setDueDate} />
    </>
  );
}
