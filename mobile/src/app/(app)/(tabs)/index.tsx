import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

import { Button, Card, Divider, ErrorView, IconButton, Loading, Row, Screen, Section, StatusIcon, Text } from "@/components/ui";
import { betsQuery, favoritesQuery, portfolioQuery } from "@/features/home/api";
import { BetsSection, FavoritesList, OperationsList, ProjectCard } from "@/features/home/portfolio";
import { notificationsQuery } from "@/features/inbox/api";
import { issuesQuery } from "@/features/issues/api";
import { useMe } from "@/lib/auth";
import { dueLabel } from "@/lib/format";
import { useTheme } from "@/theme";

/** Home: what needs you today, then the company Overview (bets, projects, operations). */
export default function Home() {
  const me = useMe();
  const { c, space } = useTheme();
  const mine = useInfiniteQuery(issuesQuery({ mine: true }));
  // The open count and "due now" need every page of my issues, not the first 100.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = mine;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const inbox = useQuery(notificationsQuery);
  const portfolio = useQuery(portfolioQuery);
  const bets = useQuery(betsQuery);
  const favorites = useQuery(favoritesQuery);

  const open = (mine.data?.pages.flatMap((p) => p.data) ?? []).filter((i) => i.status !== "done" && i.status !== "canceled");
  const due = open.filter((i) => dueLabel(i.dueDate)?.late || dueLabel(i.dueDate)?.text === "Today").slice(0, 6);
  const unread = (inbox.data ?? []).filter((n) => !n.read).length;
  const projects = (portfolio.data ?? []).filter((r) => r.kind === "project");
  const operations = (portfolio.data ?? []).filter((r) => r.kind === "operation");
  const hour = new Date().getHours();
  const refreshing = mine.isRefetching || portfolio.isRefetching || bets.isRefetching;
  const refresh = () => void Promise.all([mine.refetch(), inbox.refetch(), portfolio.refetch(), bets.refetch(), favorites.refetch()]);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: "row", marginRight: 8 }}>
              <IconButton icon="search" label="Search" onPress={() => router.push("/search")} />
              <IconButton icon="message-circle" label="Ask AI" onPress={() => router.push("/ask")} />
            </View>
          ),
        }}
      />
      <Screen refreshing={refreshing} onRefresh={refresh}>
        <View>
          <Text variant="heading">{`Good ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}${me.actor ? `, ${me.actor.name.split(" ")[0]}` : ""}`}</Text>
          <Text tone="muted">{me.workspace?.name}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Card style={{ flex: 1 }} onPress={() => router.push("/my-issues")}>
            <Text variant="display" mono>
              {mine.isPending ? "–" : open.length}
            </Text>
            <Text tone="muted">Open issues</Text>
          </Card>
          <Card style={{ flex: 1 }} onPress={() => router.push("/inbox")}>
            <Text variant="display" mono style={{ color: unread ? c.brand : c.foreground }}>
              {inbox.isPending ? "–" : unread}
            </Text>
            <Text tone="muted">Unread</Text>
          </Card>
        </View>

        <Section title="Due now">
          {mine.isPending ? (
            <Loading />
          ) : mine.isError ? (
            <ErrorView error={mine.error} onRetry={() => void mine.refetch()} />
          ) : due.length ? (
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

        {favorites.data?.length ? (
          <Section title="Favorites">
            <FavoritesList items={favorites.data} />
          </Section>
        ) : null}

        {bets.data ? <BetsSection bets={bets.data} isAdmin={me.isAdmin} /> : null}

        {portfolio.isPending ? (
          <Loading label="Loading the overview…" />
        ) : portfolio.isError ? (
          <Card>
            <ErrorView error={portfolio.error} onRetry={() => void portfolio.refetch()} />
          </Card>
        ) : (
          <>
            <Section title={`Projects · ${projects.length}`}>
              {projects.length ? (
                <View style={{ gap: space.md }}>
                  {projects.map((p) => (
                    <ProjectCard key={p.id} row={p} />
                  ))}
                </View>
              ) : (
                <Card style={{ alignItems: "center", gap: space.sm }}>
                  <Text tone="muted">No projects yet.</Text>
                  <Button title="Open projects" size="sm" icon="folder" onPress={() => router.push("/projects")} />
                </Card>
              )}
            </Section>
            <Section title={`Operations · ${operations.length}`}>
              {operations.length ? <OperationsList rows={operations} /> : <Text tone="muted">No operations yet.</Text>}
            </Section>
          </>
        )}
      </Screen>
    </>
  );
}
