import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, Share, View } from "react-native";

import { Markdown } from "@/components/markdown";
import { Avatar, Button, Card, Divider, ErrorView, Icon, IconButton, Input, Loading, Row, Screen, Section, StatusIcon, Text } from "@/components/ui";
import {
  addPageComment,
  createPage,
  PageConflict,
  pageCommentsQuery,
  pageQuery,
  pagesQuery,
  restoreTrashed,
  savePage,
  toThreads,
  trashPage,
  type PageDetail,
  type Thread,
} from "@/features/docs/api";
import { ActionSheet, type SheetAction } from "@/features/docs/action-sheet";
import { CommentComposer, CommentThreads } from "@/features/docs/comments";
import { VersionHistory } from "@/features/docs/history";
import { IconPicker } from "@/features/docs/icon-picker";
import { MarkdownEditor } from "@/features/docs/markdown-editor";
import { setFavorite, setWatching } from "@/features/issues/attachments";
import { useMe } from "@/lib/auth";
import { API_URL } from "@/lib/config";
import { ago } from "@/lib/format";
import { useTheme } from "@/theme";

export default function PageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery(pageQuery(id));
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  return <PageBody page={q.data} refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />;
}

function PageBody({ page, refreshing, onRefresh }: { page: PageDetail; refreshing: boolean; onRefresh: () => void }) {
  const { c, space } = useTheme();
  const me = useMe();
  const comments = useQuery(pageCommentsQuery(page.id));
  const all = useQuery(pagesQuery).data;
  const parent = page.parentId ? all?.find((p) => p.id === page.parentId) : undefined;
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(page.title);
  const [editingBody, setEditingBody] = useState(false);
  const [pickingIcon, setPickingIcon] = useState(false);
  const [history, setHistory] = useState(false);
  const [menu, setMenu] = useState(false);
  const [comment, setComment] = useState("");
  const [replyTo, setReplyTo] = useState<Thread | null>(null);
  const [sending, setSending] = useState(false);
  const trashed = !!page.deletedAt;
  const threads = toThreads(comments.data ?? []);
  const openCount = threads.filter((t) => !t.resolved).length;
  const link = page.url.startsWith("http") ? page.url : `${API_URL}${page.url}`;

  const refresh = () => {
    onRefresh();
    void comments.refetch();
  };

  const saveTitle = () => {
    const next = title.trim() || "Untitled";
    setEditingTitle(false);
    if (next !== page.title) void savePage(page.id, { title: next }).catch((e: Error) => Alert.alert("Couldn't rename", e.message));
  };

  const saveBody = async (text: string): Promise<boolean> => {
    try {
      await savePage(page.id, { content: text, knownUpdatedAt: page.updatedAt });
      return true;
    } catch (e) {
      if (e instanceof PageConflict) {
        Alert.alert("Someone else changed this page", "They saved after you opened it, so your edit wasn't saved over theirs. Copy your text, then reload the page and make your change again.", [
          { text: "Copy my text", onPress: () => void Clipboard.setStringAsync(text) },
          { text: "OK", style: "cancel" },
        ]);
      } else Alert.alert("Couldn't save", (e as Error).message);
      return false;
    }
  };

  const confirmTrash = () =>
    Alert.alert("Move this page to the trash?", page.subPages.length ? `Its ${page.subPages.length} sub-page${page.subPages.length === 1 ? "" : "s"} go with it. You can restore them from Trash.` : "You can restore it from Trash.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Move to trash",
        style: "destructive",
        onPress: async () => {
          try {
            await trashPage(page.id);
            router.back();
          } catch (e) {
            Alert.alert("Couldn't move it to the trash", (e as Error).message);
          }
        },
      },
    ]);

  const actions: SheetAction[] = [
    { label: "Share link", icon: "share-2", onPress: () => void Share.share({ message: `${page.icon} ${page.title || "Untitled"}\n${link}` }) },
    { label: "Copy link", icon: "link", onPress: () => void Clipboard.setStringAsync(link) },
    { label: "Version history", icon: "clock", onPress: () => setHistory(true) },
    ...(trashed ? [] : [{ label: "Move to trash", icon: "trash-2" as const, onPress: confirmTrash, destructive: true }]),
  ];

  const addSubPage = async () => {
    try {
      const id = await createPage({ parentId: page.id });
      router.push(`/pages/${id}`);
    } catch (e) {
      Alert.alert("Couldn't create the page", (e as Error).message);
    }
  };

  const send = async () => {
    if (!comment.trim()) return;
    setSending(true);
    try {
      await addPageComment(page.id, comment.trim(), replyTo?.id);
      setComment("");
      setReplyTo(null);
    } catch (e) {
      Alert.alert("Couldn't comment", (e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen
        options={{
          title: page.title || "Untitled",
          headerRight: () => (
            <View style={{ flexDirection: "row" }}>
              <IconButton icon={page.watching ? "bell" : "bell-off"} label={page.watching ? "Stop watching" : "Watch"} color={page.watching ? c.brand : c.mutedForeground} onPress={() => void setWatching("page", page.id, !page.watching).catch((e: Error) => Alert.alert("Couldn't change that", e.message))} />
              <IconButton icon="star" label={page.favorite ? "Remove from favorites" : "Add to favorites"} color={page.favorite ? "#f5b400" : c.mutedForeground} onPress={() => void setFavorite("page", page.id, !page.favorite).catch((e: Error) => Alert.alert("Couldn't change that", e.message))} />
              <IconButton icon="more-vertical" label="More" onPress={() => setMenu(true)} />
            </View>
          ),
        }}
      />
      <Screen refreshing={refreshing} onRefresh={refresh}>
        {trashed ? (
          <Card style={{ backgroundColor: c.dangerTint, borderColor: c.dangerTint, flexDirection: "row", alignItems: "center", gap: space.md }}>
            <Text variant="small" style={{ flex: 1 }}>
              This page is in the trash. Restore it to edit it again.
            </Text>
            <Button size="sm" title="Restore" onPress={() => void restoreTrashed(page.id).catch((e: Error) => Alert.alert("Couldn't restore", e.message))} />
          </Card>
        ) : null}

        {page.parentId ? (
          <Pressable onPress={() => router.push(`/pages/${page.parentId}`)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Icon name="corner-left-up" size={14} color={c.mutedForeground} />
            <Text variant="small" tone="muted" numberOfLines={1}>
              {parent ? `${parent.icon} ${parent.title || "Untitled"}` : "Parent page"}
            </Text>
          </Pressable>
        ) : null}

        <View style={{ gap: space.sm }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Change icon" disabled={trashed} onPress={() => setPickingIcon(true)} style={{ alignSelf: "flex-start" }}>
            <Text style={{ fontSize: 40, lineHeight: 48 }}>{page.icon || "📄"}</Text>
          </Pressable>
          {editingTitle ? (
            <View style={{ gap: space.sm }}>
              <Input value={title} onChangeText={setTitle} autoFocus multiline onSubmitEditing={saveTitle} blurOnSubmit style={{ minHeight: 56, fontSize: 22, fontWeight: "600" }} />
              <View style={{ flexDirection: "row", gap: space.sm }}>
                <Button title="Save" variant="primary" style={{ flex: 1 }} onPress={saveTitle} />
                <Button title="Cancel" style={{ flex: 1 }} onPress={() => { setTitle(page.title); setEditingTitle(false); }} />
              </View>
            </View>
          ) : (
            <Pressable disabled={trashed} onPress={() => { setTitle(page.title); setEditingTitle(true); }}>
              <Text variant="display">{page.title || "Untitled"}</Text>
            </Pressable>
          )}
          <Text variant="small" tone="muted">
            Edited {ago(page.updatedAt)} ago{page.creator ? ` · Created by ${page.creator.name}` : ""}
          </Text>
        </View>

        <Section
          title="Page"
          action={!trashed && page.markdownEditable ? <Button size="sm" variant="ghost" icon="edit-2" title="Edit" onPress={() => setEditingBody(true)} /> : undefined}
        >
          {!trashed && !page.markdownEditable ? (
            <Card style={{ backgroundColor: c.muted, borderColor: c.muted, flexDirection: "row", gap: space.sm }}>
              <Icon name="monitor" size={16} color={c.mutedForeground} style={{ marginTop: 2 }} />
              <Text variant="small" tone="muted" style={{ flex: 1 }}>
                This page has formatting the phone can't edit without losing it — edit it on the web. Some of it may also look plainer here than it does there.
              </Text>
            </Card>
          ) : null}
          {page.markdown.trim() ? <Markdown source={page.markdown} /> : <Text tone="muted">{trashed ? "This page is empty." : "This page is empty. Tap Edit to write it."}</Text>}
        </Section>

        {page.linkedIssues.length ? (
          <Section title={`Linked issues · ${page.linkedIssues.length}`}>
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {page.linkedIssues.map((i, n) => (
                <View key={i.id}>
                  {n > 0 ? <Divider inset={48} /> : null}
                  <Row leading={<StatusIcon status={i.status} />} title={i.title} subtitle={`${i.identifier}${i.project ? ` · ${i.project.name}` : ""}`} trailing={i.assignee ? <Avatar name={i.assignee.name} seed={i.assignee.id} size={22} /> : null} onPress={() => router.push(`/issues/${i.id}`)} />
                </View>
              ))}
            </Card>
          </Section>
        ) : null}

        <Section title={`Sub-pages${page.subPages.length ? ` · ${page.subPages.length}` : ""}`} action={trashed ? undefined : <Button size="sm" variant="ghost" icon="plus" title="Add" onPress={() => void addSubPage()} />}>
          {page.subPages.length ? (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {page.subPages.map((s, n) => (
                <View key={s.id}>
                  {n > 0 ? <Divider inset={52} /> : null}
                  <Row leading={<Text style={{ fontSize: 17, width: 24, textAlign: "center" }}>{s.icon || "📄"}</Text>} title={s.title || "Untitled"} subtitle={`Edited ${ago(s.updatedAt)} ago`} chevron onPress={() => router.push(`/pages/${s.id}`)} />
                </View>
              ))}
            </Card>
          ) : null}
        </Section>

        <Section title={`Comments${openCount ? ` · ${openCount} open` : ""}`}>
          {comments.isPending ? (
            <Loading />
          ) : comments.isError ? (
            <ErrorView error={comments.error} onRetry={() => void comments.refetch()} />
          ) : (
            <CommentThreads pageId={page.id} threads={threads} meId={me.actor?.id ?? null} onReply={setReplyTo} />
          )}
        </Section>
      </Screen>

      <CommentComposer value={comment} onChange={setComment} onSend={() => void send()} sending={sending} replyingTo={replyTo ? (replyTo.author?.name ?? "this thread") : null} onCancelReply={() => setReplyTo(null)} />

      <MarkdownEditor visible={editingBody} initial={page.markdown} title={page.title || "Untitled"} onClose={() => setEditingBody(false)} onSave={saveBody} />
      <IconPicker visible={pickingIcon} onClose={() => setPickingIcon(false)} value={page.icon} onPick={(icon) => void savePage(page.id, { icon }).catch((e: Error) => Alert.alert("Couldn't change the icon", e.message))} />
      <ActionSheet visible={menu} onClose={() => setMenu(false)} title={page.title || "Untitled"} actions={actions} />
      <VersionHistory pageId={page.id} visible={history} onClose={() => setHistory(false)} canRestore={!trashed} />
    </KeyboardAvoidingView>
  );
}
