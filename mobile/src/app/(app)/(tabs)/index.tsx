import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { View } from "react-native";

import { Card, Divider, Row, Screen, Section, StatusIcon, Text } from "@/components/ui";
import { notificationsQuery } from "@/features/inbox/api";
import { issuesQuery } from "@/features/issues/api";
import { useMe } from "@/lib/auth";
import { dueLabel } from "@/lib/format";
import { useTheme } from "@/theme";

/** Home: what needs you today. The portfolio overview is added by the Home section. */
export default function Home() {
  const me = useMe();
  const { c } = useTheme();
  const mine = useInfiniteQuery(issuesQuery({ mine: true }));
  const inbox = useQuery(notificationsQuery);
  const open = (mine.data?.pages.flatMap((p) => p.data) ?? []).filter((i) => i.status !== "done" && i.status !== "canceled");
  const due = open.filter((i) => dueLabel(i.dueDate)?.late || dueLabel(i.dueDate)?.text === "Today").slice(0, 6);
  const unread = (inbox.data ?? []).filter((n) => !n.read).length;
  const hour = new Date().getHours();
  return (
    <Screen refreshing={mine.isRefetching} onRefresh={() => void Promise.all([mine.refetch(), inbox.refetch()])}>
      <View>
        <Text variant="heading">{`Good ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}${me.actor ? `, ${me.actor.name.split(" ")[0]}` : ""}`}</Text>
        <Text tone="muted">{me.workspace?.name}</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Card style={{ flex: 1 }} onPress={() => router.push("/my-issues")}>
          <Text variant="display" mono>
            {open.length}
          </Text>
          <Text tone="muted">Open issues</Text>
        </Card>
        <Card style={{ flex: 1 }} onPress={() => router.push("/inbox")}>
          <Text variant="display" mono style={{ color: unread ? c.brand : c.foreground }}>
            {unread}
          </Text>
          <Text tone="muted">Unread</Text>
        </Card>
      </View>
      <Section title="Due now">
        {due.length ? (
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {due.map((i, n) => (
              <View key={i.id}>
                {n > 0 ? <Divider inset={48} /> : null}
                <Row leading={<StatusIcon status={i.status} />} title={i.title} subtitle={`${i.identifier} · ${dueLabel(i.dueDate)?.text ?? ""}`} onPress={() => router.push(`/issues/${i.id}`)} />
              </View>
            ))}
          </Card>
        ) : (
          <Text tone="muted">Nothing due today or overdue.</Text>
        )}
      </Section>
    </Screen>
  );
}
