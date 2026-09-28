import * as Linking from "expo-linking";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { View } from "react-native";

import { Button, Card, Divider, Empty, Field, Icon, Screen, Text } from "@/components/ui";
import { IssueList } from "@/features/issues/issue-list";
import { GROUP_OF, type SearchHit } from "@/features/search/api";
import { API_URL } from "@/lib/config";
import { useTheme } from "@/theme";

/**
 * A search result without a screen of its own (a milestone, cycle, feature,
 * account, contact — or a ticket or deal outside any project). Shows the facts
 * the search returned, opens the project it belongs to, and for milestones and
 * cycles lists their issues.
 */
export default function RecordScreen() {
  const params = useLocalSearchParams<{ type: string; id: string; hit?: string }>();
  const hit = useMemo<SearchHit | null>(() => {
    try {
      const h = params.hit ? (JSON.parse(params.hit) as SearchHit) : null;
      return h && h.id === params.id ? h : null;
    } catch {
      return null;
    }
  }, [params.hit, params.id]);

  if (!hit) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Not found" }} />
        <Empty icon="search" title="This result has expired" body="Search for it again to open it." action={<Button title="Search" icon="search" onPress={() => router.replace("/search")} style={{ marginTop: 8 }} />} />
      </Screen>
    );
  }

  const header = <RecordHeader hit={hit} />;
  if (hit.type === "milestone" || hit.type === "cycle") {
    return (
      <View style={{ flex: 1 }}>
        <Stack.Screen options={{ title: GROUP_OF[hit.type].label.replace(/s$/, "") }} />
        <IssueList filters={hit.type === "milestone" ? { milestone: hit.id } : { cycle: hit.id }} header={header} emptyTitle="No issues yet" emptyBody={`Issues added to this ${hit.type} show up here.`} />
      </View>
    );
  }
  return (
    <Screen>
      <Stack.Screen options={{ title: GROUP_OF[hit.type]?.label.replace(/s$/, "") ?? "Result" }} />
      {header}
    </Screen>
  );
}

function RecordHeader({ hit }: { hit: SearchHit }) {
  const { c, space } = useTheme();
  const group = GROUP_OF[hit.type];
  const url = hit.url.startsWith("/") ? `${API_URL}${hit.url}` : hit.url;
  return (
    <View style={{ gap: space.md, padding: hit.type === "milestone" || hit.type === "cycle" ? space.lg : 0 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Icon name={group?.icon ?? "circle"} size={16} color={c.mutedForeground} />
        <Text variant="small" tone="muted" weight="600" style={{ textTransform: "uppercase", letterSpacing: 0.6 }}>
          {group?.label.replace(/s$/, "") ?? hit.type}
        </Text>
      </View>
      <Text variant="heading">{hit.title}</Text>
      {hit.fields.length ? (
        <Card style={{ paddingVertical: 4 }}>
          {hit.fields.map((f, i) => (
            <View key={f.label}>
              {i > 0 ? <Divider /> : null}
              <Field label={f.label}>
                <Text selectable style={{ flex: 1 }}>
                  {f.value}
                </Text>
              </Field>
            </View>
          ))}
        </Card>
      ) : null}
      <View style={{ flexDirection: "row", gap: space.sm }}>
        {hit.projectId ? <Button title="Open project" icon="folder" style={{ flex: 1 }} onPress={() => router.push(`/projects/${hit.projectId}`)} /> : null}
        <Button title="Open on the web" icon="external-link" style={{ flex: 1 }} onPress={() => void Linking.openURL(url)} />
      </View>
    </View>
  );
}
