import { useQuery } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { FlatList, View } from "react-native";

import { Avatar, Divider, Empty, ErrorView, IconButton, Loading, Row, Text } from "@/components/ui";
import { markRead, notificationsQuery, type Notification } from "@/features/inbox/api";
import { ago } from "@/lib/format";
import { useTheme } from "@/theme";

export default function Inbox() {
  const { c } = useTheme();
  const q = useQuery(notificationsQuery);
  const open = (n: Notification) => {
    if (!n.read) void markRead(n.id);
    if (n.issueId) router.push(`/issues/${n.issueId}`);
    else if (n.pageId) router.push(`/pages/${n.pageId}`);
    else if (n.projectId) router.push(`/projects/${n.projectId}`);
  };
  const unread = q.data?.some((n) => !n.read);
  return (
    <>
      <Stack.Screen options={{ headerRight: () => (unread ? <IconButton icon="check-square" label="Mark all read" onPress={() => void markRead()} /> : null) }} />
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorView error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(n) => n.id}
          refreshing={q.isRefetching}
          onRefresh={() => void q.refetch()}
          ItemSeparatorComponent={() => <Divider inset={56} />}
          ListEmptyComponent={<Empty icon="inbox" title="You're all caught up" body="Mentions, assignments and replies land here." />}
          renderItem={({ item: n }) => (
            <Row
              onPress={() => open(n)}
              leading={
                <View>
                  <Avatar name={n.actor?.name ?? "Internal"} seed={n.actor?.id} size={32} />
                  {!n.read ? <View style={{ position: "absolute", right: -2, top: -2, width: 10, height: 10, borderRadius: 5, backgroundColor: c.brand, borderWidth: 2, borderColor: c.background }} /> : null}
                </View>
              }
              title={
                <Text numberOfLines={2} weight={n.read ? "400" : "600"}>
                  {n.title}
                </Text>
              }
              subtitle={n.body ? n.body : undefined}
              trailing={
                <Text variant="caption" tone="muted">
                  {ago(n.createdAt)}
                </Text>
              }
            />
          )}
        />
      )}
    </>
  );
}
