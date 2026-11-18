import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, SectionList, View } from "react-native";

import { Divider, Empty, ErrorView, Loading, Picker, Text } from "@/components/ui";
import { useTheme } from "@/theme";

import { rowsQuery, type Scope } from "./api";
import { ChipRow, FilterButton, StagePill, Warnings } from "./bits";
import { addDays, applyFilters, isOpen, NO_FILTERS, shortDate, type ProspectKind, type ProspectRow } from "./model";
import { openRecord } from "./my-work";

/**
 * The Prospects tab laid out by due date — the web's "By due date" timeline as
 * it shows on a phone: open records with a next step, under Overdue, each of
 * the next seven days, and the two weeks after.
 */
export function DueView({ kind, scope, header }: { kind: ProspectKind; scope: Scope; header: React.ReactElement }) {
  const { c, space } = useTheme();
  const q = useQuery(rowsQuery(kind, scope));
  const [owner, setOwner] = useState("");
  const [ownerSheet, setOwnerSheet] = useState(false);
  const today = q.data?.today ?? "";
  const me = q.data?.me ?? "";

  const sections = useMemo(() => {
    if (!today) return [];
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
    const later = addDays(today, 21);
    const cols = [{ key: "overdue", title: "Overdue" }, ...days.map((d) => ({ key: d, title: shortDate(d, today) })), { key: "later", title: "Next 2 weeks" }];
    const colOf = (d: string) => (d < today ? "overdue" : d <= days[6] ? d : d <= later ? "later" : null);
    const open = applyFilters(q.data?.data ?? [], { ...NO_FILTERS, owner }, me).filter((r) => isOpen(r) && r.nextStepDate);
    return cols
      .map((col) => ({ ...col, data: open.filter((r) => colOf(r.nextStepDate!) === col.key).sort((a, b) => (a.nextStepDate ?? "").localeCompare(b.nextStepDate ?? "")) }))
      .filter((s) => s.data.length > 0);
  }, [q.data, owner, me, today]);

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;

  const ownerLabel = owner === "" ? "Owner: everyone" : owner === "me" ? "Owner: me" : owner === "none" ? "Owner: nobody" : `Owner: ${owner}`;

  return (
    <>
      <SectionList<ProspectRow, { key: string; title: string; data: ProspectRow[] }>
        sections={sections}
        keyExtractor={(r) => r.id}
        refreshing={q.isRefetching}
        onRefresh={() => void q.refetch()}
        stickySectionHeadersEnabled
        ListHeaderComponent={
          <View style={{ gap: space.md, paddingBottom: space.md }}>
            {header}
            <Warnings warnings={q.data.warnings} />
            <ChipRow>
              <FilterButton label={ownerLabel} active={owner !== ""} onPress={() => setOwnerSheet(true)} />
            </ChipRow>
          </View>
        }
        ListEmptyComponent={<Empty icon="calendar" title="No next steps scheduled" body="Set a follow-up date on a record and it appears here." />}
        ListFooterComponent={<View style={{ height: 96 }} />}
        ItemSeparatorComponent={() => <Divider inset={space.lg} />}
        renderSectionHeader={({ section }) => (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: space.lg, paddingVertical: 10, backgroundColor: c.muted }}>
            <Text variant="small" weight="600" tone={section.key === "overdue" ? "danger" : "default"} style={{ flex: 1 }}>
              {section.title}
            </Text>
            <Text variant="small" tone="muted" mono>
              {section.data.length.toLocaleString("en-IN")}
            </Text>
          </View>
        )}
        renderItem={({ item: r }) => (
          <Pressable onPress={() => openRecord(r.kind, r.id)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, backgroundColor: pressed ? c.muted : c.background })}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text weight="500" numberOfLines={1}>
                {r.name}
              </Text>
              {r.nextStep ? (
                <Text variant="small" tone="muted" numberOfLines={1}>
                  {r.nextStep}
                </Text>
              ) : null}
            </View>
            <View style={{ alignItems: "flex-end", gap: 4, maxWidth: 130 }}>
              <StagePill stage={r.stage} />
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {r.assigned || "Unassigned"}
              </Text>
            </View>
          </Pressable>
        )}
      />
      <Picker
        visible={ownerSheet}
        onClose={() => setOwnerSheet(false)}
        title="Owner"
        value={owner || "__all"}
        options={[{ value: "__all", label: "Everyone" }, { value: "me", label: "Me" }, { value: "none", label: "Nobody" }, ...(q.data.team ?? []).map((t) => ({ value: t, label: t }))]}
        onPick={(v) => setOwner(v === "__all" ? "" : v)}
      />
    </>
  );
}
