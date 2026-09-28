import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Markdown } from "@/components/markdown";
import { Button, Card, Divider, Icon, IconButton, Row, Text } from "@/components/ui";
import { askStream, AskError, type AskSource } from "@/features/ask/stream";
import { api } from "@/lib/api";
import { useTheme } from "@/theme";

type Turn = { id: number; question: string; answer: string; sources: AskSource[]; state: "reading" | "writing" | "done" | "error" | "stopped"; error?: string };

const SUGGESTIONS = ["What are we shipping this cycle?", "Summarize the open work on the mobile project", "What decisions are documented about auth?"];

/** Ask AI: answers grounded in the workspace's docs and issues, streamed as they are written. */
export default function Ask() {
  const { c, space, radius, type } = useTheme();
  const insets = useSafeAreaInsets();
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const abort = useRef<AbortController | null>(null);
  const scroll = useRef<ScrollView>(null);
  const nextId = useRef(1);
  const busy = turns.some((t) => t.state === "reading" || t.state === "writing");

  useEffect(() => () => abort.current?.abort(), []);

  const patch = (id: number, p: Partial<Turn> | ((t: Turn) => Partial<Turn>)) => setTurns((all) => all.map((t) => (t.id === id ? { ...t, ...(typeof p === "function" ? p(t) : p) } : t)));

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const id = nextId.current++;
    setQuestion("");
    setTurns((all) => [...all, { id, question: q, answer: "", sources: [], state: "reading" }]);
    const controller = new AbortController();
    abort.current = controller;
    try {
      await askStream(
        q,
        (ev) => {
          if (ev.type === "sources") patch(id, { sources: ev.sources });
          else if (ev.type === "delta") patch(id, (t) => ({ answer: t.answer + ev.text, state: "writing" }));
          else if (ev.type === "done") patch(id, { state: "done" });
        },
        controller.signal,
      );
      patch(id, (t) => ({ state: controller.signal.aborted ? "stopped" : t.state === "error" ? "error" : "done" }));
    } catch (e) {
      if (controller.signal.aborted) return patch(id, { state: "stopped" });
      // Let the app's normal sign-out handling run when the key was revoked.
      if (e instanceof AskError && e.status === 401) void api.get("/me").catch(() => undefined);
      patch(id, { state: "error", error: e instanceof Error ? e.message : "Couldn't answer that." });
    } finally {
      if (abort.current === controller) abort.current = null;
    }
  };

  const stop = () => abort.current?.abort();

  const openSource = (s: AskSource) => router.push(s.kind === "issue" ? `/issues/${s.id}` : `/pages/${s.id}`);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: "Ask AI", headerRight: () => (turns.length && !busy ? <IconButton icon="rotate-ccw" label="Clear answers" onPress={() => setTurns([])} /> : null) }} />
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
        {turns.length === 0 ? (
          <View style={{ gap: space.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
              <Icon name="zap" color={c.brand} />
              <Text variant="title">Ask your workspace</Text>
            </View>
            <Text tone="muted">Answers come only from the docs and issues you can see, with links to each one used.</Text>
            <View style={{ gap: space.sm, marginTop: space.sm }}>
              {SUGGESTIONS.map((s) => (
                <Pressable key={s} onPress={() => void ask(s)} style={({ pressed }) => ({ borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: 10, backgroundColor: pressed ? c.muted : c.card })}>
                  <Text variant="small">{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          turns.map((t) => (
            <View key={t.id} style={{ gap: space.sm }}>
              <View style={{ alignSelf: "flex-end", maxWidth: "88%", backgroundColor: c.brandTint, borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: 8 }}>
                <Text>{t.question}</Text>
              </View>
              <Card>
                {t.state === "reading" ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                    <ActivityIndicator color={c.brand} size="small" />
                    <Text tone="muted">Reading your workspace…</Text>
                  </View>
                ) : null}
                {t.answer ? <Markdown source={t.answer} /> : null}
                {t.state === "writing" ? <View style={{ width: 8, height: 16, backgroundColor: c.brand, borderRadius: 2 }} /> : null}
                {t.state === "stopped" ? (
                  <Text variant="small" tone="muted">
                    Stopped.
                  </Text>
                ) : null}
                {t.state === "error" ? (
                  <View style={{ gap: space.sm }}>
                    <Text tone="danger">{t.error}</Text>
                    <Button title="Ask again" size="sm" icon="refresh-cw" onPress={() => void ask(t.question)} disabled={busy} style={{ alignSelf: "flex-start" }} />
                  </View>
                ) : null}
                {t.sources.length ? (
                  <View style={{ marginTop: 4, marginHorizontal: -space.lg, marginBottom: -space.sm }}>
                    <Text variant="small" tone="muted" weight="600" style={{ paddingHorizontal: space.lg, paddingBottom: 4, textTransform: "uppercase", letterSpacing: 0.6 }}>
                      Sources
                    </Text>
                    {t.sources.map((s, i) => (
                      <View key={`${s.kind}-${s.id}`}>
                        {i > 0 ? <Divider inset={48} /> : null}
                        <Row leading={<Icon name={s.kind === "issue" ? "circle" : "file-text"} size={16} color={c.mutedForeground} />} title={s.title} onPress={() => openSource(s)} chevron style={{ minHeight: 44, paddingVertical: 8, backgroundColor: "transparent" }} />
                      </View>
                    ))}
                  </View>
                ) : null}
              </Card>
            </View>
          ))
        )}
      </ScrollView>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: insets.bottom + space.sm, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.background }}>
        <TextInput
          value={question}
          onChangeText={setQuestion}
          placeholder="Ask anything about your workspace…"
          placeholderTextColor={c.mutedForeground}
          multiline
          maxLength={1000}
          style={[type.body, { flex: 1, color: c.foreground, backgroundColor: c.muted, borderRadius: radius.lg, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, maxHeight: 120 }]}
        />
        {busy ? (
          <Button title="Stop" icon="square" onPress={stop} />
        ) : (
          <Button title="Ask" variant="brand" icon="send" disabled={!question.trim()} onPress={() => void ask(question)} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
