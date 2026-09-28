import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActionSheetIOS, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, Share, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Markdown } from "@/components/markdown";
import { Avatar, Badge, Button, Card, Divider, ErrorView, Field, Icon, IconButton, Input, Loading, PriorityIcon, Row, Screen, Section, StatusIcon, Text } from "@/components/ui";
import { addComment, deleteComment, issueQuery, refreshIssue, timelineQuery, updateIssue, type IssueDetail } from "@/features/issues/api";
import { uploadAttachment, deleteAttachment, setFavorite, setWatching } from "@/features/issues/attachments";
import { AssigneesPicker, DatePicker, LabelsPicker, NumberPicker, PriorityPicker, ProjectPicker, StatusPicker, TypePicker } from "@/features/issues/pickers";
import { api } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { ISSUE_TYPE_MAP, PRIORITY_MAP, STATUS_MAP } from "@/lib/constants";
import { ago, dueLabel, shortDate } from "@/lib/format";
import { useTheme } from "@/theme";

type Sheet = "status" | "priority" | "type" | "assignees" | "labels" | "project" | "due" | "start" | "estimate" | null;

export default function IssueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery(issueQuery(id));
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  return <IssueBody issue={q.data} refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />;
}

function IssueBody({ issue, refreshing, onRefresh }: { issue: IssueDetail; refreshing: boolean; onRefresh: () => void }) {
  const { c, space } = useTheme();
  const me = useMe();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(issue.title);
  const [editingBody, setEditingBody] = useState(false);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const timeline = useQuery(timelineQuery(issue.id));

  const patch = (p: Record<string, unknown>) => void updateIssue(issue.id, p).catch((e: Error) => Alert.alert("Couldn't save", e.message));
  const due = dueLabel(issue.dueDate);
  const assignees = issue.assignees.length ? issue.assignees : issue.assignee ? [issue.assignee] : [];

  const more = () => {
    const actions = ["Share link", "Copy ID", "Delete issue", "Cancel"];
    const run = (i: number) => {
      if (i === 0) void Share.share({ message: `${issue.identifier} ${issue.title}\n${issue.url}` });
      if (i === 1) void Clipboard.setStringAsync(issue.identifier);
      if (i === 2)
        Alert.alert("Delete this issue?", "It's removed for everyone in the workspace.", [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              await api.del(`/issues/${issue.id}`);
              await refreshIssue();
              router.back();
            },
          },
        ]);
    };
    if (Platform.OS === "ios") ActionSheetIOS.showActionSheetWithOptions({ options: actions, destructiveButtonIndex: 2, cancelButtonIndex: 3 }, run);
    else Alert.alert(issue.identifier, undefined, [{ text: "Share link", onPress: () => run(0) }, { text: "Copy ID", onPress: () => run(1) }, { text: "Delete issue", style: "destructive", onPress: () => run(2) }, { text: "Cancel", style: "cancel" }]);
  };

  const attach = async (kind: "photo" | "file") => {
    try {
      let file: { uri: string; name: string; mimeType?: string | null } | null = null;
      if (kind === "photo") {
        const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
        if (!r.canceled) file = { uri: r.assets[0].uri, name: r.assets[0].fileName ?? "photo.jpg", mimeType: r.assets[0].mimeType };
      } else {
        const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
        if (!r.canceled) file = { uri: r.assets[0].uri, name: r.assets[0].name, mimeType: r.assets[0].mimeType };
      }
      if (!file) return;
      setUploading(true);
      await uploadAttachment(issue.id, file);
    } catch (e) {
      Alert.alert("Couldn't attach", (e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen
        options={{
          title: issue.identifier,
          headerRight: () => (
            <View style={{ flexDirection: "row" }}>
              <IconButton icon={issue.watching ? "bell" : "bell-off"} label={issue.watching ? "Stop watching" : "Watch"} color={issue.watching ? c.brand : c.mutedForeground} onPress={() => void setWatching("issue", issue.id, !issue.watching)} />
              <IconButton icon="star" label={issue.favorite ? "Remove from favorites" : "Add to favorites"} color={issue.favorite ? "#f5b400" : c.mutedForeground} onPress={() => void setFavorite("issue", issue.id, !issue.favorite)} />
              <IconButton icon="more-vertical" label="More" onPress={more} />
            </View>
          ),
        }}
      />
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        {editingTitle ? (
          <View style={{ gap: space.sm }}>
            <Input value={title} onChangeText={setTitle} autoFocus multiline style={{ minHeight: 60, fontSize: 20, fontWeight: "600" }} />
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Button title="Save" variant="primary" style={{ flex: 1 }} disabled={!title.trim()} onPress={() => { patch({ title: title.trim() }); setEditingTitle(false); }} />
              <Button title="Cancel" style={{ flex: 1 }} onPress={() => { setTitle(issue.title); setEditingTitle(false); }} />
            </View>
          </View>
        ) : (
          <Pressable onLongPress={() => setEditingTitle(true)} onPress={() => setEditingTitle(true)}>
            <Text variant="heading">{issue.title}</Text>
            {issue.parentId ? (
              <Text variant="small" tone="brand" onPress={() => router.push(`/issues/${issue.parentId}`)} style={{ marginTop: 4 }}>
                Sub-issue of parent ›
              </Text>
            ) : null}
          </Pressable>
        )}

        <Card style={{ paddingVertical: 4 }}>
          <Field label="Status" onPress={() => setSheet("status")}>
            <StatusIcon status={issue.status} />
            <Text>{STATUS_MAP[issue.status]?.label ?? issue.status}</Text>
          </Field>
          <Divider />
          <Field label="Priority" onPress={() => setSheet("priority")}>
            <PriorityIcon priority={issue.priority} />
            <Text>{PRIORITY_MAP[issue.priority]?.label ?? issue.priority}</Text>
          </Field>
          <Divider />
          <Field label="Assignees" onPress={() => setSheet("assignees")}>
            {assignees.length ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                {assignees.slice(0, 4).map((a) => (
                  <Avatar key={a.id} name={a.name} seed={a.id} size={22} />
                ))}
                <Text numberOfLines={1} style={{ flex: 1 }}>
                  {assignees.map((a) => a.name.split(" ")[0]).join(", ")}
                </Text>
              </View>
            ) : (
              <Text tone="muted">Unassigned</Text>
            )}
          </Field>
          <Divider />
          <Field label="Due" onPress={() => setSheet("due")}>
            <Text style={{ color: due?.late ? c.destructive : c.foreground }}>{issue.dueDate ? `${shortDate(issue.dueDate)}${due ? ` · ${due.text}` : ""}` : "—"}</Text>
          </Field>
          <Divider />
          <Field label="Type" onPress={() => setSheet("type")}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: ISSUE_TYPE_MAP[issue.type]?.color ?? c.mutedForeground }} />
            <Text>{ISSUE_TYPE_MAP[issue.type]?.label ?? issue.type}</Text>
          </Field>
          <Divider />
          <Field label="Labels" onPress={() => setSheet("labels")}>
            {issue.labels.length ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, flex: 1 }}>
                {issue.labels.map((l) => (
                  <Badge key={l.id} label={l.name} color={l.color} dot />
                ))}
              </View>
            ) : (
              <Text tone="muted">None</Text>
            )}
          </Field>
          <Divider />
          <Field label="Project" onPress={() => setSheet("project")}>
            <Text numberOfLines={1}>{issue.project?.name ?? "—"}</Text>
          </Field>
          <Divider />
          <Field label="Start" onPress={() => setSheet("start")}>
            <Text>{issue.startDate ? shortDate(issue.startDate) : "—"}</Text>
          </Field>
          <Divider />
          <Field label="Estimate" onPress={() => setSheet("estimate")}>
            <Text>{issue.estimate ?? "—"}</Text>
          </Field>
        </Card>

        <Section title="Description" action={<Button size="sm" variant="ghost" icon="edit-2" title="Edit" onPress={() => setEditingBody(true)} />}>
          {issue.description ? <Markdown source={issue.description} /> : <Text tone="muted">No description yet.</Text>}
        </Section>

        <Section title={`Sub-issues${issue.subIssues.length ? ` · ${issue.subIssues.filter((s) => s.status === "done").length}/${issue.subIssues.length}` : ""}`} action={<Button size="sm" variant="ghost" icon="plus" title="Add" onPress={() => router.push({ pathname: "/issues/new", params: { parent: issue.id, project: issue.project?.id ?? "" } })} />}>
          {issue.subIssues.length ? (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {issue.subIssues.map((s, i) => (
                <View key={s.id}>
                  {i > 0 ? <Divider inset={48} /> : null}
                  <Row leading={<StatusIcon status={s.status} />} title={s.title} subtitle={s.identifier} onPress={() => router.push(`/issues/${s.id}`)} />
                </View>
              ))}
            </Card>
          ) : null}
        </Section>

        {issue.relations.length ? (
          <Section title="Relations">
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {issue.relations.map((r, i) => (
                <View key={r.id}>
                  {i > 0 ? <Divider /> : null}
                  <Row
                    leading={r.issue ? <StatusIcon status={r.issue.status} /> : <Icon name="link" />}
                    title={r.issue?.title ?? "Related issue"}
                    subtitle={`${r.type.replace("_", " ")}${r.issue ? ` · ${r.issue.identifier}` : ""}`}
                    onPress={() => router.push(`/issues/${r.issueId}`)}
                  />
                </View>
              ))}
            </Card>
          </Section>
        ) : null}

        {issue.pages.length ? (
          <Section title="Linked docs">
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {issue.pages.map((p, i) => (
                <View key={p.id}>
                  {i > 0 ? <Divider /> : null}
                  <Row leading={<Text>{p.icon || "📄"}</Text>} title={p.title || "Untitled"} chevron onPress={() => router.push(`/pages/${p.id}`)} />
                </View>
              ))}
            </Card>
          </Section>
        ) : null}

        <Section
          title="Attachments"
          action={
            <View style={{ flexDirection: "row" }}>
              <Button size="sm" variant="ghost" icon="image" title="Photo" loading={uploading} onPress={() => void attach("photo")} />
              <Button size="sm" variant="ghost" icon="paperclip" title="File" disabled={uploading} onPress={() => void attach("file")} />
            </View>
          }
        >
          {issue.attachments.length ? (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {issue.attachments.map((a, i) => (
                <View key={a.id}>
                  {i > 0 ? <Divider /> : null}
                  <Row
                    leading={<Icon name={a.contentType?.startsWith("image/") ? "image" : "file"} />}
                    title={a.name}
                    subtitle={`${Math.max(1, Math.round(a.size / 1024))} KB`}
                    onPress={() => void Linking.openURL(a.url)}
                    onLongPress={() =>
                      Alert.alert("Remove attachment?", a.name, [
                        { text: "Cancel", style: "cancel" },
                        { text: "Remove", style: "destructive", onPress: () => void deleteAttachment(issue.id, a.id) },
                      ])
                    }
                  />
                </View>
              ))}
            </Card>
          ) : null}
        </Section>

        <Section title="Activity">
          <View style={{ gap: space.md }}>
            {(timeline.data ?? issue.comments.map((cm) => ({ id: cm.id, kind: "comment" as const, body: cm.body, actor: cm.author, createdAt: cm.createdAt })))
              .slice()
              .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
              .map((e) =>
                e.kind === "comment" ? (
                  <Pressable
                    key={e.id}
                    onLongPress={() =>
                      e.actor?.id === me.actor?.id &&
                      Alert.alert("Delete comment?", undefined, [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", style: "destructive", onPress: () => void deleteComment(issue.id, e.id) },
                      ])
                    }
                  >
                    <Card style={{ gap: 6 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Avatar name={e.actor?.name} seed={e.actor?.id} size={22} />
                        <Text weight="600" style={{ flex: 1 }}>
                          {e.actor?.name ?? "Someone"}
                        </Text>
                        <Text variant="caption" tone="muted">
                          {ago(e.createdAt)}
                        </Text>
                      </View>
                      <Markdown source={e.body} compact />
                    </Card>
                  </Pressable>
                ) : (
                  <View key={e.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 }}>
                    <Avatar name={e.actor?.name} seed={e.actor?.id} size={18} />
                    <Text variant="small" tone="muted" style={{ flex: 1 }}>
                      <Text variant="small" weight="600">
                        {e.actor?.name?.split(" ")[0] ?? "Someone"}
                      </Text>{" "}
                      {e.action}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {ago(e.createdAt)}
                    </Text>
                  </View>
                ),
              )}
          </View>
        </Section>
      </Screen>

      <Composer
        value={comment}
        onChange={setComment}
        sending={sending}
        onSend={async () => {
          if (!comment.trim()) return;
          setSending(true);
          try {
            await addComment(issue.id, comment.trim());
            setComment("");
            await timeline.refetch();
          } catch (e) {
            Alert.alert("Couldn't comment", (e as Error).message);
          } finally {
            setSending(false);
          }
        }}
      />

      <StatusPicker visible={sheet === "status"} onClose={() => setSheet(null)} value={issue.status} onPick={(v) => patch({ status: v })} />
      <PriorityPicker visible={sheet === "priority"} onClose={() => setSheet(null)} value={issue.priority} onPick={(v) => patch({ priority: v })} />
      <TypePicker visible={sheet === "type"} onClose={() => setSheet(null)} value={issue.type} onPick={(v) => patch({ type: v })} />
      <ProjectPicker visible={sheet === "project"} onClose={() => setSheet(null)} value={issue.project?.id ?? null} onPick={(v) => patch({ projectId: v })} />
      <AssigneesPicker visible={sheet === "assignees"} onClose={() => setSheet(null)} value={assignees.map((a) => a.id)} onPick={(v) => patch({ assigneeIds: v })} />
      <LabelsPicker visible={sheet === "labels"} onClose={() => setSheet(null)} value={issue.labels.map((l) => l.id)} onPick={(v) => patch({ labelIds: v })} />
      <DatePicker title="Due date" visible={sheet === "due"} onClose={() => setSheet(null)} value={issue.dueDate} onPick={(v) => patch({ dueDate: v })} />
      <DatePicker title="Start date" visible={sheet === "start"} onClose={() => setSheet(null)} value={issue.startDate} onPick={(v) => patch({ startDate: v })} />
      <NumberPicker title="Estimate (points)" visible={sheet === "estimate"} onClose={() => setSheet(null)} value={issue.estimate} onPick={(v) => patch({ estimate: v })} />
      <DescriptionEditor visible={editingBody} initial={issue.description ?? ""} onClose={() => setEditingBody(false)} onSave={(v) => patch({ description: v })} />
    </KeyboardAvoidingView>
  );
}

function Composer({ value, onChange, onSend, sending }: { value: string; onChange: (v: string) => void; onSend: () => void; sending: boolean }) {
  const { c, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: insets.bottom + space.sm, borderTopWidth: 0.5, borderTopColor: c.border, backgroundColor: c.background }}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Leave a comment…"
        placeholderTextColor={c.mutedForeground}
        multiline
        style={{ flex: 1, maxHeight: 120, minHeight: 40, color: c.foreground, backgroundColor: c.muted, borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15 }}
      />
      <IconButton icon="send" label="Send comment" color={value.trim() ? c.brand : c.mutedForeground} disabled={!value.trim() || sending} onPress={onSend} />
    </View>
  );
}

/** Full-screen Markdown editor for the description. */
export function DescriptionEditor({ visible, initial, onClose, onSave, title = "Description" }: { visible: boolean; initial: string; onClose: () => void; onSave: (v: string) => void; title?: string }) {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(initial);
  return (
    <Modal visible={visible} animationType="slide" onShow={() => setText(initial)} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space.md }}>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Text variant="title">{title}</Text>
          <Button
            title="Save"
            variant="brand"
            size="sm"
            onPress={() => {
              onSave(text);
              onClose();
            }}
          />
        </View>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          autoFocus
          placeholder="Write in Markdown — # headings, - lists, **bold**, [links](https://…)"
          placeholderTextColor={c.mutedForeground}
          style={{ flex: 1, padding: space.lg, color: c.foreground, fontSize: 16, lineHeight: 23, textAlignVertical: "top" }}
        />
        <Text variant="caption" tone="muted" style={{ padding: space.md, paddingBottom: insets.bottom + space.md }}>
          Markdown. Headings, lists, checkboxes, bold, italic, code and links.
        </Text>
      </View>
    </Modal>
  );
}
