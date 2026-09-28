import { useQuery } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";

import { Button, Empty, ErrorView, Fab, Loading, Row, Screen, Text } from "@/components/ui";
import { createProjectPage, projectPagesQuery, projectQuery } from "@/features/projects/api";
import { ListCard } from "@/features/projects/components";
import { ago } from "@/lib/format";
import { useTheme } from "@/theme";

/** The project's pages in the order the web's page tree shows them. Tap one to read it. */
export default function ProjectDocsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { space } = useTheme();
  const project = useQuery(projectQuery(id)).data;
  const q = useQuery(projectPagesQuery(id));
  const [creating, setCreating] = useState(false);

  const newPage = async () => {
    setCreating(true);
    try {
      const page = await createProjectPage(id);
      router.push(`/pages/${page.id}`);
    } catch (e) {
      Alert.alert("Couldn't create the page", (e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: project ? `${project.name} · Docs` : "Docs" }} />
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorView error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
          {q.data.length ? (
            <ListCard>
              {q.data.map((p) => (
                <Row
                  key={p.id}
                  style={{ paddingLeft: space.lg + p.depth * 18 }}
                  leading={<Text>{p.icon || "📄"}</Text>}
                  title={p.title || "Untitled"}
                  subtitle={`Edited ${ago(p.updatedAt)} ago${p.childCount ? ` · ${p.childCount} sub-page${p.childCount === 1 ? "" : "s"}` : ""}`}
                  chevron
                  onPress={() => router.push(`/pages/${p.id}`)}
                />
              ))}
            </ListCard>
          ) : (
            <Empty icon="file-text" title="No docs yet" body="Specs, decisions and runbooks for this project live here." action={<Button title="New page" icon="plus" variant="brand" loading={creating} onPress={() => void newPage()} style={{ marginTop: space.sm }} />} />
          )}
        </Screen>
      )}
      {q.data?.length ? <Fab label="New page" onPress={() => void (creating ? null : newPage())} /> : null}
    </>
  );
}
