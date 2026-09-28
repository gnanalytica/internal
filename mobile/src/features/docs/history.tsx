import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Modal, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Markdown } from "@/components/markdown";
import { Avatar, Button, Card, Divider, Empty, ErrorView, Loading, Row, Screen, Sheet, Text } from "@/components/ui";
import { ago, longDate } from "@/lib/format";
import { useTheme } from "@/theme";

import { pageVersionQuery, pageVersionsQuery, restoreVersion, type PageVersion } from "./api";

const CAUSE: Record<string, string> = { auto: "Saved automatically", restore: "Before a restore", conflict: "Before an overlapping save" };

/** Version history: a list of snapshots, each opening a read-only preview with Restore. */
export function VersionHistory({ pageId, visible, onClose, canRestore }: { pageId: string; visible: boolean; onClose: () => void; canRestore: boolean }) {
  const q = useQuery({ ...pageVersionsQuery(pageId), enabled: visible });
  const [open, setOpen] = useState<PageVersion | null>(null);
  return (
    <>
      <Sheet visible={visible && !open} onClose={onClose} title="Version history">
        {q.isPending ? (
          <Loading />
        ) : q.isError ? (
          <ErrorView error={q.error} onRetry={() => void q.refetch()} />
        ) : q.data.length === 0 ? (
          <Empty icon="clock" title="No earlier versions" body="A snapshot is kept at most every 10 minutes while the page is edited, and before every restore." />
        ) : (
          q.data.map((v, i) => (
            <View key={v.id}>
              {i > 0 ? <Divider inset={56} /> : null}
              <Row leading={<Avatar name={v.author?.name ?? "Someone"} seed={v.author?.id} size={28} />} title={longDate(v.createdAt)} subtitle={`${CAUSE[v.cause] ?? "Snapshot"}${v.author ? ` · ${v.author.name}` : ""} · ${v.title || "Untitled"}`} chevron onPress={() => setOpen(v)} />
            </View>
          ))
        )}
      </Sheet>
      <VersionPreview pageId={pageId} version={open} canRestore={canRestore} onBack={() => setOpen(null)} onRestored={() => { setOpen(null); onClose(); }} />
    </>
  );
}

function VersionPreview({ pageId, version, canRestore, onBack, onRestored }: { pageId: string; version: PageVersion | null; canRestore: boolean; onBack: () => void; onRestored: () => void }) {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();
  const q = useQuery({ ...pageVersionQuery(pageId, version?.id ?? ""), enabled: !!version });
  const [restoring, setRestoring] = useState(false);
  const restore = () =>
    Alert.alert("Restore this version?", "The page goes back to how it was then. Its current state is saved to history first, so you can undo this.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Restore",
        onPress: async () => {
          if (!version) return;
          setRestoring(true);
          try {
            await restoreVersion(pageId, version.id);
            onRestored();
          } catch (e) {
            Alert.alert("Couldn't restore", (e as Error).message);
          } finally {
            setRestoring(false);
          }
        },
      },
    ]);
  return (
    <Modal visible={!!version} animationType="slide" onRequestClose={onBack}>
      <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space.md, gap: space.sm }}>
          <Button title="Back" icon="chevron-left" variant="ghost" onPress={onBack} />
          <Text variant="title" numberOfLines={1} style={{ flex: 1, textAlign: "center" }}>
            {version ? ago(version.createdAt) + " ago" : ""}
          </Text>
          {canRestore ? <Button title="Restore" variant="brand" size="sm" loading={restoring} disabled={!q.data} onPress={restore} /> : <View style={{ width: 60 }} />}
        </View>
        {q.isPending ? (
          <Loading />
        ) : q.isError ? (
          <ErrorView error={q.error} onRetry={() => void q.refetch()} />
        ) : (
          <Screen>
            {!q.data.complete ? (
              <Card style={{ backgroundColor: c.warningTint, borderColor: c.warningTint }}>
                <Text variant="small">This preview leaves out formatting the phone can't show (colours, callouts, toggles and similar). Restoring brings all of it back.</Text>
              </Card>
            ) : null}
            <Text variant="heading">{q.data.title || "Untitled"}</Text>
            <Text variant="small" tone="muted">
              {longDate(q.data.createdAt)}
              {q.data.author ? ` · ${q.data.author.name}` : ""}
            </Text>
            {q.data.markdown.trim() ? <Markdown source={q.data.markdown} /> : <Text tone="muted">This version was empty.</Text>}
          </Screen>
        )}
      </View>
    </Modal>
  );
}
