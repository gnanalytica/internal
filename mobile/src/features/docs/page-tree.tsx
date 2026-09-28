import { router } from "expo-router";
import { Alert, Pressable, View } from "react-native";

import { Icon, Row, Text } from "@/components/ui";
import { ago } from "@/lib/format";
import { useTheme } from "@/theme";

import { createPage, trashPage, type PageSummary } from "./api";
import type { TreeNode } from "./tree";

/** One line of the page tree: indent, a disclosure chevron when it has sub-pages, icon, title. */
export function TreeRow({ node, onToggle, onCreated }: { node: TreeNode; onToggle: (id: string) => void; onCreated?: (parentId: string) => void }) {
  const { c } = useTheme();
  const { page, depth, hasChildren, expanded } = node;
  return (
    <Row
      style={{ paddingLeft: 8 + depth * 18, minHeight: 48, paddingVertical: 8 }}
      onPress={() => router.push(`/pages/${page.id}`)}
      onLongPress={() => pageActions(page, onCreated)}
      leading={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hasChildren ? (expanded ? `Collapse ${page.title || "Untitled"}` : `Expand ${page.title || "Untitled"}`) : undefined}
            disabled={!hasChildren}
            hitSlop={8}
            onPress={() => onToggle(page.id)}
            style={{ width: 24, height: 24, alignItems: "center", justifyContent: "center" }}
          >
            {hasChildren ? <Icon name={expanded ? "chevron-down" : "chevron-right"} size={16} color={c.mutedForeground} /> : null}
          </Pressable>
          <Text style={{ fontSize: 17, width: 24, textAlign: "center" }}>{page.icon || "📄"}</Text>
        </View>
      }
      title={page.title || "Untitled"}
      trailing={
        page.updatedAt ? (
          <Text variant="caption" tone="muted">
            {ago(page.updatedAt)}
          </Text>
        ) : null
      }
    />
  );
}

/** Long-press menu on a page: open, add a sub-page, or trash it. */
export function pageActions(page: PageSummary, onCreated?: (parentId: string) => void) {
  const name = page.title || "Untitled";
  Alert.alert(`${page.icon || "📄"} ${name}`, undefined, [
    {
      text: "New sub-page",
      onPress: async () => {
        try {
          const id = await createPage({ parentId: page.id });
          onCreated?.(page.id);
          router.push(`/pages/${id}`);
        } catch (e) {
          Alert.alert("Couldn't create the page", (e as Error).message);
        }
      },
    },
    {
      text: "Move to trash",
      style: "destructive",
      onPress: () =>
        Alert.alert(`Move "${name}" to the trash?`, "Its sub-pages go with it. You can restore them from Trash.", [
          { text: "Cancel", style: "cancel" },
          { text: "Move to trash", style: "destructive", onPress: () => void trashPage(page.id).catch((e: Error) => Alert.alert("Couldn't move it to the trash", e.message)) },
        ]),
    },
    { text: "Cancel", style: "cancel" },
  ]);
}
