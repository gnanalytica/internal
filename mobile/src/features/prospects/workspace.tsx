import { useQuery } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { Button, IconButton, Picker, Segmented, Text } from "@/components/ui";
import { Pipeline as DealsView } from "@/features/business/sales/pipeline";
import { useTheme } from "@/theme";

import { readTime, refreshFromSheet, rowsQuery, type Scope } from "./api";
import { fail, notify } from "./bits";
import { CustomersView, type CustomersShow } from "./customers";
import { DueView } from "./due-view";
import { ListView } from "./list";
import { KIND_LABEL, PROSPECT_KINDS, type ProspectKind } from "./model";
import { MyWorkView } from "./my-work";
import { OverviewView } from "./overview";
import { PipelineView } from "./pipeline";
import { PlaybookView } from "./playbook-view";

// The web's tabs (src/components/prospects-dashboard/workspace.tsx). Your day
// and Playbook are pages without a tab: "Start calling" and the ⋯ menu open them.
const TABS = [
  { value: "insights", label: "Insights" },
  { value: "list", label: "Prospects" },
  { value: "customers", label: "Customers" },
  { value: "deals", label: "Deals" },
] as const;
type Tab = (typeof TABS)[number]["value"] | "today" | "playbook";
const HOME: Tab = "insights";

/** The Prospects tab's layouts: a list, by stage, or by due date (web: ProspectLayout). */
type Layout = "list" | "board" | "timeline";
const LAYOUTS: { value: Layout; label: string }[] = [
  { value: "list", label: "List" },
  { value: "board", label: "By stage" },
  { value: "timeline", label: "By due date" },
];

/** Tab ids from before, so old links (`?tab=mywork`) still land somewhere sensible. */
const OLD_TABS: Record<string, Tab> = { mywork: "today", overview: "insights", pipeline: "list" };

function tabFrom(v: string | undefined): Tab {
  if (!v) return HOME;
  if (OLD_TABS[v]) return OLD_TABS[v];
  return v === "today" || v === "playbook" || TABS.some((t) => t.value === v) ? (v as Tab) : HOME;
}

function layoutFrom(layout: string | undefined, tab: string | undefined): Layout {
  if (layout === "board" || layout === "timeline") return layout;
  return tab === "pipeline" ? "board" : "list";
}

type Menu = "today" | "playbook" | "refresh" | "sheet";

/**
 * Valytica's Sales on a phone — the same workspace the web shows. Everything
 * shown is read from the prospects Google Sheet through the API; everything
 * changed here is written back to it.
 *
 * `project` adds what only the project's Sales has: the Deals tab, and (when
 * the project has Customer Success on) the Customers tab.
 */
export function ProspectsWorkspace({
  project,
  initialTab,
  initialLayout,
  initialCustomers,
}: {
  project?: { id: string; customers: boolean };
  initialTab?: string;
  initialLayout?: string;
  /** `?cf=requests` opens Customers on the open requests. */
  initialCustomers?: CustomersShow;
}) {
  const { c, space } = useTheme();
  const tabs = TABS.filter((t) => (t.value !== "customers" || project?.customers) && (t.value !== "deals" || project));
  const [tabState, setTab] = useState<Tab>(tabFrom(initialTab));
  const tab: Tab = tabState === "today" || tabState === "playbook" || tabs.some((t) => t.value === tabState) ? tabState : HOME;
  const [layout, setLayout] = useState<Layout>(layoutFrom(initialLayout, initialTab));
  const [kind, setKind] = useState<ProspectKind>("valuer");
  const [scope, setScope] = useState<Scope>("focus");
  const [listView, setListView] = useState<{ view?: string; stage?: number | null; n: number }>({ n: 0 });
  const [pb, setPb] = useState("anchor");
  const [refreshing, setRefreshing] = useState(false);
  const [menu, setMenu] = useState(false);
  const usesKind = tab === "list" || tab === "insights";
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
    setLayout("list");
    setTab("list");
  };

  const onMenu = (m: Menu) => {
    if (m === "today" || m === "playbook") setTab(m);
    else if (m === "refresh") void reread();
    else if (rows.data?.sheetUrl) void Linking.openURL(rows.data.sheetUrl);
  };

  const header = (
    <View style={{ gap: space.sm, paddingTop: space.sm }}>
      <View style={{ paddingHorizontal: space.lg }}>
        {tab === "today" || tab === "playbook" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <Button size="sm" variant="ghost" icon="arrow-left" title={tab === "today" ? "Prospects" : "Back"} onPress={() => setTab(tab === "today" ? "list" : HOME)} />
            <Text variant="title">{tab === "today" ? "Your day" : "Playbook"}</Text>
          </View>
        ) : (
          <Segmented<Tab> value={tab} onChange={setTab} options={tabs.map((t) => ({ value: t.value, label: t.label }))} />
        )}
      </View>
      {tab === "list" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg }}>
          <View style={{ flex: 1 }}>
            <Segmented<Layout> value={layout} onChange={setLayout} options={LAYOUTS} />
          </View>
          <Button size="sm" variant="brand" icon="phone" title="Start calling" onPress={() => setTab("today")} />
        </View>
      ) : null}
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
      {(usesKind && kind === "valuer") || tab === "today" ? (
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
              <IconButton icon="more-horizontal" label="More" onPress={() => setMenu(true)} />
            </View>
          ),
        }}
      />
      {tab === "today" ? (
        <MyWorkView
          scope={scope}
          header={header}
          onFind={() => {
            setKind("valuer");
            gotoList("a-new");
          }}
        />
      ) : tab === "list" && layout === "board" ? (
        <PipelineView key={kind} kind={kind} scope={scope} header={header} onMore={(stage) => gotoList("all", stage)} />
      ) : tab === "list" && layout === "timeline" ? (
        <DueView key={kind} kind={kind} scope={scope} header={header} />
      ) : tab === "list" ? (
        <ListView key={`${kind}:${listView.n}`} kind={kind} scope={scope} header={header} initialView={listView.view} initialStage={listView.stage} />
      ) : tab === "insights" ? (
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
      ) : tab === "customers" && project ? (
        <CustomersView projectId={project.id} header={header} initialShow={initialCustomers} />
      ) : tab === "deals" && project ? (
        <DealsView projectId={project.id} header={header} />
      ) : (
        <PlaybookView section={pb} setSection={setPb} header={header} />
      )}
      <Picker<Menu>
        visible={menu}
        onClose={() => setMenu(false)}
        title="Sales"
        value={null}
        options={[
          { value: "today", label: "Your day", subtitle: "Your follow-ups, one at a time" },
          { value: "playbook", label: "Playbook" },
          { value: "refresh", label: "Re-read the sheet" },
          ...(rows.data?.sheetUrl ? [{ value: "sheet" as const, label: "Open the sheet" }] : []),
        ]}
        onPick={onMenu}
      />
    </View>
  );
}
