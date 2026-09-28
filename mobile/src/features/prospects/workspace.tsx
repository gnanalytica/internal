import { useQuery } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { IconButton, Segmented, Text } from "@/components/ui";
import { useTheme } from "@/theme";

import { readTime, refreshFromSheet, rowsQuery, type Scope } from "./api";
import { fail, notify } from "./bits";
import { ListView } from "./list";
import { KIND_LABEL, PROSPECT_KINDS, type ProspectKind } from "./model";
import { MyWorkView } from "./my-work";
import { OverviewView } from "./overview";
import { PipelineView } from "./pipeline";
import { PlaybookView } from "./playbook-view";

const TABS = [
  { value: "mywork", label: "My work" },
  { value: "list", label: "List" },
  { value: "pipeline", label: "Pipeline" },
  { value: "overview", label: "Overview" },
  { value: "playbook", label: "Playbook" },
] as const;
type Tab = (typeof TABS)[number]["value"];

/**
 * The Prospects tab. Everything shown is read from the prospects Google Sheet
 * through the API; everything changed here is written back to it.
 */
export function ProspectsWorkspace() {
  const { c, space } = useTheme();
  const [tab, setTab] = useState<Tab>("mywork");
  const [kind, setKind] = useState<ProspectKind>("valuer");
  const [scope, setScope] = useState<Scope>("focus");
  const [listView, setListView] = useState<{ view?: string; stage?: number | null; n: number }>({ n: 0 });
  const [pb, setPb] = useState("anchor");
  const [refreshing, setRefreshing] = useState(false);
  const usesKind = tab === "list" || tab === "pipeline" || tab === "overview";
  const rows = useQuery({ ...rowsQuery(kind, scope), enabled: usesKind });
  const counts = rows.data?.counts;

  const reread = async () => {
    setRefreshing(true);
    try {
      await refreshFromSheet();
      notify("Re-read the sheet");
    } catch (e) {
      fail("Couldn't refresh", e);
    } finally {
      setRefreshing(false);
    }
  };

  const gotoList = (view?: string, stage?: number | null) => {
    setListView((l) => ({ view, stage, n: l.n + 1 }));
    setTab("list");
  };

  const header = (
    <View style={{ gap: space.sm, paddingTop: space.sm }}>
      <View style={{ paddingHorizontal: space.lg }}>
        <Segmented value={tab} onChange={setTab} options={TABS.map((t) => ({ value: t.value, label: t.label }))} />
      </View>
      {usesKind ? (
        <View style={{ paddingHorizontal: space.lg }}>
          <Segmented
            value={kind}
            onChange={(k) => {
              setKind(k);
              setListView((l) => ({ n: l.n + 1 }));
            }}
            options={PROSPECT_KINDS.map((k) => ({ value: k, label: counts ? `${KIND_LABEL[k].many} ${counts[k].toLocaleString("en-IN")}` : KIND_LABEL[k].many }))}
          />
        </View>
      ) : null}
      {tab !== "playbook" && (kind === "valuer" || tab === "mywork") ? (
        <View style={{ paddingHorizontal: space.lg }}>
          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              { value: "focus", label: "KA · AP · TS" },
              { value: "all", label: rows.data ? `All India ${rows.data.totals.valuer.toLocaleString("en-IN")}` : "All India" },
            ]}
          />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 2, marginRight: 8 }}>
              {rows.data?.readAt ? (
                <Text variant="caption" tone="muted">
                  Read {readTime(rows.data.readAt)}
                </Text>
              ) : null}
              {refreshing ? <ActivityIndicator color={c.brand} style={{ padding: 6 }} /> : <IconButton icon="refresh-cw" label="Re-read the sheet now" onPress={() => void reread()} />}
              {rows.data?.sheetUrl ? <IconButton icon="external-link" label="Open the sheet" onPress={() => void Linking.openURL(rows.data!.sheetUrl)} /> : null}
            </View>
          ),
        }}
      />
      {tab === "mywork" ? (
        <MyWorkView scope={scope} header={header} />
      ) : tab === "list" ? (
        <ListView key={`${kind}:${listView.n}`} kind={kind} scope={scope} header={header} initialView={listView.view} initialStage={listView.stage} />
      ) : tab === "pipeline" ? (
        <PipelineView key={kind} kind={kind} scope={scope} header={header} onMore={(stage) => gotoList("all", stage)} />
      ) : tab === "overview" ? (
        <OverviewView
          kind={kind}
          scope={scope}
          header={header}
          onGotoList={(v) => gotoList(v)}
          onGotoPlaybook={(s) => {
            setPb(s);
            setTab("playbook");
          }}
        />
      ) : (
        <PlaybookView section={pb} setSection={setPb} header={header} />
      )}
    </View>
  );
}
