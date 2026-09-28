import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, SectionList, View } from "react-native";

import { Button, Divider, Empty, ErrorView, Icon, Loading, Picker, Text } from "@/components/ui";
import { useTheme } from "@/theme";

import { rowsQuery, saveProspect, type Scope } from "./api";
import { BandBadge, ChipRow, DueChip, fail, FilterButton, notify, StagePill, stageColor, Warnings } from "./bits";
import { applyFilters, byUrgency, NO_FILTERS, STAGES, UNSCORED_KINDS, type ProspectKind, type ProspectRow } from "./model";
import { openRecord } from "./my-work";

const SECTION_CAP = 30;

/**
 * The web's board as a phone list: one section per stage with its count,
 * overdue first then highest score. A record changes stage through a picker
 * instead of a drag; the change is written to the sheet at once.
 */
export function PipelineView({ kind, scope, header, onMore }: { kind: ProspectKind; scope: Scope; header: React.ReactElement; onMore: (stage: number) => void }) {
  const { c, space } = useTheme();
  const q = useQuery(rowsQuery(kind, scope));
  const [owner, setOwner] = useState("");
  const [ownerSheet, setOwnerSheet] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set([5, 6]));
  const [moving, setMoving] = useState<ProspectRow | null>(null);
  // Optimistic stage per record while the sheet write is in flight.
  const [moved, setMoved] = useState<Record<string, number>>({});
  const today = q.data?.today ?? "";
  const me = q.data?.me ?? "";
  const scored = !UNSCORED_KINDS.has(kind);

  const sections = useMemo(() => {
    const rows = applyFilters(q.data?.data ?? [], { ...NO_FILTERS, owner }, me).map((r) => (moved[r.id] !== undefined ? { ...r, stage: moved[r.id] } : r));
    const order = byUrgency(today);
    return STAGES.map((stage, i) => {
      const all = rows.filter((r) => r.stage === i).sort(order);
      return { stage: i, title: stage, total: all.length, data: collapsed.has(i) ? [] : all.slice(0, SECTION_CAP) };
    });
  }, [q.data, owner, me, moved, today, collapsed]);

  const move = async (r: ProspectRow, stage: number) => {
    if (stage === r.stage) return;
    setMoved((m) => ({ ...m, [r.id]: stage }));
    try {
      await saveProspect(r.kind, r.id, { status: STAGES[stage] });
      notify(`${r.name}: status → ${STAGES[stage]}`);
    } catch (e) {
      fail("Couldn't change the status", e);
    } finally {
      setMoved((m) => {
        const { [r.id]: _, ...rest } = m;
        return rest;
      });
    }
  };

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;

  const ownerLabel = owner === "" ? "Owner: everyone" : owner === "me" ? "Owner: me" : owner === "none" ? "Owner: nobody" : `Owner: ${owner}`;

  return (
    <>
      <SectionList
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
            <Text variant="small" tone="muted" style={{ paddingHorizontal: space.lg }}>
              Overdue first, then highest score. Tap the status on a row to move it — the change is written to the sheet.
            </Text>
          </View>
        }
        ListEmptyComponent={<Empty title="No records" />}
        ListFooterComponent={<View style={{ height: 96 }} />}
        ItemSeparatorComponent={() => <Divider inset={space.lg} />}
        renderSectionHeader={({ section }) => {
          const open = !collapsed.has(section.stage);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              onPress={() =>
                setCollapsed((s) => {
                  const next = new Set(s);
                  if (next.has(section.stage)) next.delete(section.stage);
                  else next.add(section.stage);
                  return next;
                })
              }
              style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: space.lg, paddingVertical: 10, backgroundColor: c.muted }}
            >
              <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: stageColor(section.stage, c)[1] }} />
              <Text variant="small" weight="600" style={{ flex: 1 }}>
                {section.title}
              </Text>
              <Text variant="small" tone="muted" mono>
                {section.total.toLocaleString("en-IN")}
              </Text>
              <Icon name={open ? "chevron-up" : "chevron-down"} size={16} color={c.mutedForeground} />
            </Pressable>
          );
        }}
        renderSectionFooter={({ section }) =>
          !collapsed.has(section.stage) && section.total > section.data.length ? (
            <Button size="sm" variant="ghost" title={`See all ${section.total.toLocaleString("en-IN")} in the List`} style={{ alignSelf: "flex-start", marginHorizontal: space.sm, marginBottom: space.sm }} onPress={() => onMore(section.stage)} />
          ) : null
        }
        renderItem={({ item: r }) => (
          <Pressable onPress={() => openRecord(r.kind, r.id)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, backgroundColor: pressed ? c.muted : c.background })}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text weight="500" numberOfLines={1}>
                {r.name}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {r.city || r.state || "—"} · {r.assigned || "Unassigned"}
                {scored ? ` · ${r.lenders ? `${r.lenders} panels` : "panels ?"} · ${r.cases !== null ? `${r.cases}/mo` : "volume ?"}` : ""}
              </Text>
              {r.nextStep ? (
                <Text variant="small" numberOfLines={1}>
                  {r.nextStep}
                </Text>
              ) : null}
              <View style={{ flexDirection: "row", gap: 6 }}>
                {scored ? <BandBadge band={r.band} score={r.score} /> : null}
                {r.nextStepDate ? <DueChip date={r.nextStepDate} today={today} /> : null}
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Change status of ${r.name}, now ${STAGES[r.stage]}`} hitSlop={8} onPress={() => setMoving(r)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 2, opacity: pressed ? 0.6 : 1 })}>
              <StagePill stage={r.stage} />
              <Icon name="chevron-down" size={14} color={c.mutedForeground} />
            </Pressable>
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
      <Picker
        visible={!!moving}
        onClose={() => setMoving(null)}
        title={moving ? `Move ${moving.name}` : "Status"}
        value={moving ? String(moving.stage) : null}
        options={STAGES.map((s, i) => ({ value: String(i), label: s, leading: <StagePill stage={i} /> }))}
        onPick={(v) => moving && void move(moving, Number(v))}
      />
    </>
  );
}
