import { useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Markdown } from "@/components/markdown";
import { Avatar, Button, Card, Divider, IconButton, Text } from "@/components/ui";
import { ago } from "@/lib/format";
import { useTheme } from "@/theme";

import { deletePageComment, REACTIONS, setCommentResolved, toggleCommentReaction, type PageComment, type Thread } from "./api";

/** Comment threads, open ones first and resolved ones folded away, like the web's side panel. */
export function CommentThreads({ pageId, threads, meId, onReply }: { pageId: string; threads: Thread[]; meId: string | null; onReply: (thread: Thread) => void }) {
  const { space } = useTheme();
  const [showResolved, setShowResolved] = useState(false);
  const open = threads.filter((t) => !t.resolved);
  const resolved = threads.filter((t) => t.resolved);
  return (
    <View style={{ gap: space.md }}>
      {open.length === 0 && resolved.length === 0 ? <Text tone="muted">No comments yet. Start a thread below.</Text> : null}
      {open.map((t) => (
        <ThreadCard key={t.id} pageId={pageId} thread={t} meId={meId} onReply={() => onReply(t)} />
      ))}
      {resolved.length ? (
        <Button
          size="sm"
          variant="ghost"
          icon={showResolved ? "chevron-up" : "chevron-down"}
          title={showResolved ? "Hide resolved threads" : `Show ${resolved.length} resolved thread${resolved.length === 1 ? "" : "s"}`}
          onPress={() => setShowResolved((v) => !v)}
          style={{ alignSelf: "flex-start" }}
        />
      ) : null}
      {showResolved ? resolved.map((t) => <ThreadCard key={t.id} pageId={pageId} thread={t} meId={meId} onReply={() => onReply(t)} />) : null}
    </View>
  );
}

function ThreadCard({ pageId, thread, meId, onReply }: { pageId: string; thread: Thread; meId: string | null; onReply: () => void }) {
  const { c, space } = useTheme();
  const fail = (what: string) => (e: Error) => Alert.alert(what, e.message);
  return (
    <Card style={{ gap: space.sm, opacity: thread.resolved ? 0.75 : 1 }}>
      {thread.blockId ? (
        <Text variant="caption" tone="muted">
          On a passage of the page
        </Text>
      ) : null}
      <CommentBody pageId={pageId} comment={thread} meId={meId} />
      {thread.replies.map((r) => (
        <View key={r.id} style={{ gap: space.sm }}>
          <Divider />
          <CommentBody pageId={pageId} comment={r} meId={meId} />
        </View>
      ))}
      <View style={{ flexDirection: "row", gap: 4, marginTop: 2 }}>
        <Button size="sm" variant="ghost" icon="corner-down-right" title="Reply" onPress={onReply} />
        <Button
          size="sm"
          variant="ghost"
          icon={thread.resolved ? "rotate-ccw" : "check"}
          title={thread.resolved ? "Reopen" : "Resolve"}
          onPress={() => void setCommentResolved(pageId, thread.id, !thread.resolved).catch(fail(thread.resolved ? "Couldn't reopen" : "Couldn't resolve"))}
          style={{ marginLeft: "auto" }}
        />
      </View>
      {thread.resolved ? (
        <Text variant="caption" style={{ color: c.success }}>
          Resolved
        </Text>
      ) : null}
    </Card>
  );
}

function CommentBody({ pageId, comment, meId }: { pageId: string; comment: PageComment; meId: string | null }) {
  const { c, radius } = useTheme();
  const [picking, setPicking] = useState(false);
  const mine = !!meId && comment.author?.id === meId;
  const react = (emoji: string) => {
    setPicking(false);
    void toggleCommentReaction(pageId, comment.id, emoji).catch((e: Error) => Alert.alert("Couldn't react", e.message));
  };
  const remove = () =>
    Alert.alert(comment.parentId ? "Delete this reply?" : "Delete this comment?", comment.parentId ? undefined : "Replies to it are deleted too.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void deletePageComment(pageId, comment.id).catch((e: Error) => Alert.alert("Couldn't delete", e.message)) },
    ]);
  return (
    <Pressable onLongPress={mine ? remove : () => setPicking(true)} style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Avatar name={comment.author?.name ?? "Someone"} seed={comment.author?.id} size={22} />
        <Text weight="600" style={{ flex: 1 }} numberOfLines={1}>
          {comment.author?.name ?? "Someone"}
        </Text>
        <Text variant="caption" tone="muted">
          {ago(comment.createdAt)}
        </Text>
        <IconButton icon="smile" size={16} label="React" color={c.mutedForeground} onPress={() => setPicking((v) => !v)} />
        {mine ? <IconButton icon="trash-2" size={16} label="Delete comment" color={c.mutedForeground} onPress={remove} /> : null}
      </View>
      <Markdown source={comment.body} compact />
      {comment.reactions.length || picking ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {comment.reactions.map((r) => (
            <Pressable
              key={r.emoji}
              accessibilityRole="button"
              accessibilityLabel={`${r.emoji} ${r.count}${r.mine ? ", yours" : ""}`}
              onPress={() => react(r.emoji)}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, height: 26, borderRadius: radius.full, borderWidth: 1, borderColor: r.mine ? c.brand : c.border, backgroundColor: r.mine ? c.brandTint : c.card }}
            >
              <Text variant="small">{r.emoji}</Text>
              <Text variant="caption" weight="600" style={{ color: r.mine ? c.brand : c.mutedForeground }}>
                {r.count}
              </Text>
            </Pressable>
          ))}
          {picking
            ? REACTIONS.filter((e) => !comment.reactions.some((r) => r.emoji === e && r.mine)).map((e) => (
                <Pressable key={e} accessibilityRole="button" accessibilityLabel={`React with ${e}`} onPress={() => react(e)} style={{ paddingHorizontal: 6, height: 26, justifyContent: "center", borderRadius: radius.full, backgroundColor: c.muted }}>
                  <Text variant="small">{e}</Text>
                </Pressable>
              ))
            : null}
        </View>
      ) : null}
    </Pressable>
  );
}

/** The comment box pinned under the page. Shows who a reply is going to. */
export function CommentComposer({ value, onChange, onSend, sending, replyingTo, onCancelReply }: { value: string; onChange: (v: string) => void; onSend: () => void; sending: boolean; replyingTo: string | null; onCancelReply: () => void }) {
  const { c, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: insets.bottom + space.sm, borderTopWidth: 0.5, borderTopColor: c.border, backgroundColor: c.background, gap: 6 }}>
      {replyingTo ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text variant="small" tone="muted" style={{ flex: 1 }} numberOfLines={1}>
            Replying to {replyingTo}
          </Text>
          <IconButton icon="x" size={16} label="Cancel reply" color={c.mutedForeground} onPress={onCancelReply} />
        </View>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.sm }}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={replyingTo ? "Write a reply…" : "Comment on this page…"}
          placeholderTextColor={c.mutedForeground}
          multiline
          style={{ flex: 1, maxHeight: 120, minHeight: 40, color: c.foreground, backgroundColor: c.muted, borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15 }}
        />
        <IconButton icon="send" label={replyingTo ? "Send reply" : "Send comment"} color={value.trim() ? c.brand : c.mutedForeground} disabled={!value.trim() || sending} onPress={onSend} />
      </View>
    </View>
  );
}
