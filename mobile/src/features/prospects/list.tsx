import { useQuery } from "@tanstack/react-query";
import { memo, useCallback, useDeferredValue, useMemo, useState } from "react";
import { FlatList, Pressable, View } from "react-native";

import { Button, Divider, Empty, ErrorView, Icon, Loading, Picker, SearchBar, Text } from "@/components/ui";
import { useTheme } from "@/theme";

import { assignToMe, rowsQuery, type Scope } from "./api";
import { BandBadge, ChipRow, DueChip, fail, FilterButton, notify, StagePill, Warnings } from "./bits";
import { applyFilters, BANDS, byScore, FACT_COUNT, NO_FILTERS, SAVED_VIEWS, STAGES, UNSCORED_KINDS, type Filters, type ProspectKind, type ProspectRow } from "./model";
import { openRecord } from "./my-work";

const ROW_HEIGHT = 76;
const MAX_SELECTED = 50;

type Sheet = "owner" | "band" | "stage" | null;

/**
 * The web's List tab: saved views, search, owner/band/status filters, and
 * multi-select to take records. A fixed row height lets the list jump and
 * scroll through all ~3,000 valuers without measuring each row.
 */
export function ListView({ kind, scope, header, initialView, initialStage }: { kind: ProspectKind; scope: Scope; header: React.ReactElement; initialView?: string; initialStage?: number | null }) {
  const { c, space } = useTheme();
  const q = useQuery(rowsQuery(kind, scope));
  const [view, setView] = useState(initialView ?? "all");
  const [filters, setFilters] = useState<Filters>({ ...NO_FILTERS, stage: initialStage ?? null });
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);

  const rows = useMemo(() => q.data?.data ?? [], [q.data]);
  const me = q.data?.me ?? "";
  const today = q.data?.today ?? "";
  const team = q.data?.team ?? [];
  const ctx = useMemo(() => ({ person: me, today }), [me, today]);
  const current = SAVED_VIEWS.find((v) => v.id === view) ?? SAVED_VIEWS[0];
  const viewCounts = useMemo(() => Object.fromEntries(SAVED_VIEWS.map((v) => [v.id, rows.filter((r) => v.test(r, ctx)).length])), [rows, ctx]);
  const shown = useMemo(
    () => applyFilters(rows, { ...filters, q: deferredSearch }, me).filter((r) => current.test(r, ctx)).sort(byScore),
    [rows, filters, deferredSearch, me, current, ctx],
  );
  const selecting = selected.size > 0;
  const scored = !UNSCORED_KINDS.has(kind);

  const toggle = useCallback((id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_SELECTED) next.add(id);
      else notify(`Up to ${MAX_SELECTED} at a time`);
      return next;
    });
  }, []);
  const onPress = useCallback((r: ProspectRow) => (selecting ? toggle(r.id) : openRecord(r.kind, r.id)), [selecting, toggle]);

  const take = async () => {
    setAssigning(true);
    try {
      const res = await assignToMe(kind, [...selected]);
      notify(res.message);
      setSelected(new Set());
    } catch (e) {
      fail("Couldn't assign", e);
    } finally {
      setAssigning(false);
    }
  };

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;

  const ownerLabel = filters.owner === "" ? "Owner: everyone" : filters.owner === "me" ? "Owner: me" : filters.owner === "none" ? "Owner: nobody" : `Owner: ${filters.owner}`;
  const listHeader = (
    <View style={{ gap: space.md, paddingBottom: space.sm }}>
      {header}
      <Warnings warnings={q.data.warnings} />
      <ChipRow>
        {SAVED_VIEWS.map((v) => {
          const on = v.id === view;
          return (
            <Pressable
              key={v.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => {
                setView(v.id);
                setSelected(new Set());
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 999, backgroundColor: on ? c.foreground : c.muted }}
            >
              <Text variant="small" weight="600" style={{ color: on ? c.background : c.foreground }}>
                {v.label}
              </Text>
              <Text variant="caption" mono style={{ color: on ? c.background : c.mutedForeground }}>
                {(viewCounts[v.id] ?? 0).toLocaleString("en-IN")}
              </Text>
            </Pressable>
          );
        })}
      </ChipRow>
      <View style={{ paddingHorizontal: space.lg }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search name, reg no, city" />
      </View>
      <ChipRow>
        <FilterButton label={ownerLabel} active={filters.owner !== ""} onPress={() => setSheet("owner")} />
        {scored ? <FilterButton label={filters.band ? `Band: ${filters.band}` : "Band: any"} active={!!filters.band} onPress={() => setSheet("band")} /> : null}
        <FilterButton label={filters.stage === null ? "Status: any" : STAGES[filters.stage]} active={filters.stage !== null} onPress={() => setSheet("stage")} />
        {filters.owner || filters.band || filters.stage !== null ? <Button size="sm" variant="ghost" title="Clear" onPress={() => setFilters(NO_FILTERS)} /> : null}
      </ChipRow>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, paddingHorizontal: space.lg }}>
        {current.chips.map((ch) => (
          <View key={ch} style={{ backgroundColor: c.muted, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
            <Text variant="caption" weight="600">
              {ch}
            </Text>
          </View>
        ))}
        <Text variant="small" tone="muted">
          {shown.length.toLocaleString("en-IN")} rows{selecting ? "" : " · long-press to select"}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={shown}
        keyExtractor={(r) => r.id}
        refreshing={q.isRefetching}
        onRefresh={() => void q.refetch()}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={<Empty icon="filter" title="Nothing matches this view" body="Try another view, or clear the filters and search." />}
        ListFooterComponent={<View style={{ height: selecting ? 120 : 96 }} />}
        getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
        initialNumToRender={14}
        maxToRenderPerBatch={20}
        windowSize={9}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => <ListRow r={item} today={today} scored={scored} checked={selected.has(item.id)} selecting={selecting} onPress={onPress} onLongPress={toggle} />}
      />
      {selecting ? (
        <View style={{ position: "absolute", left: space.lg, right: space.lg, bottom: space.lg, flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.sm, paddingLeft: space.md, borderRadius: 12, backgroundColor: c.foreground, elevation: 6 }}>
          <Text weight="600" style={{ flex: 1, color: c.background }}>
            {selected.size} selected
          </Text>
          <Button size="sm" title="Clear" variant="ghost" style={{ backgroundColor: "transparent" }} onPress={() => setSelected(new Set())} />
          <Button size="sm" title="Assign to me" variant="brand" loading={assigning} onPress={() => void take()} />
        </View>
      ) : null}
      <Picker
        visible={sheet === "owner"}
        onClose={() => setSheet(null)}
        title="Owner"
        value={filters.owner || "__all"}
        options={[{ value: "__all", label: "Everyone" }, { value: "me", label: "Me" }, { value: "none", label: "Nobody" }, ...team.map((t) => ({ value: t, label: t }))]}
        onPick={(v) => setFilters((f) => ({ ...f, owner: v === "__all" ? "" : v }))}
      />
      <Picker
        visible={sheet === "band"}
        onClose={() => setSheet(null)}
        title="Band"
        value={filters.band || "__any"}
        options={[{ value: "__any", label: "Any band" }, ...BANDS.map((b) => ({ value: b, label: b, leading: <BandBadge band={b} /> }))]}
        onPick={(v) => setFilters((f) => ({ ...f, band: v === "__any" ? "" : v }))}
      />
      <Picker
        visible={sheet === "stage"}
        onClose={() => setSheet(null)}
        title="Status"
        value={filters.stage === null ? "__any" : String(filters.stage)}
        options={[{ value: "__any", label: "Any status" }, ...STAGES.map((s, i) => ({ value: String(i), label: s, leading: <StagePill stage={i} /> }))]}
        onPick={(v) => setFilters((f) => ({ ...f, stage: v === "__any" ? null : Number(v) }))}
      />
    </View>
  );
}

const ListRow = memo(function ListRow({ r, today, scored, checked, selecting, onPress, onLongPress }: { r: ProspectRow; today: string; scored: boolean; checked: boolean; selecting: boolean; onPress: (r: ProspectRow) => void; onLongPress: (id: string) => void }) {
  const { c, space } = useTheme();
  return (
    <View style={{ height: ROW_HEIGHT }}>
      <Pressable
        onPress={() => onPress(r)}
        onLongPress={() => onLongPress(r.id)}
        accessibilityLabel={`${r.name}, ${r.city || r.state}`}
        accessibilityState={selecting ? { checked } : undefined}
        style={({ pressed }) => ({ flex: 1, flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, backgroundColor: checked ? c.brandTint : pressed ? c.muted : c.background })}
      >
        {selecting ? (
          <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: checked ? c.brand : c.border, backgroundColor: checked ? c.brand : "transparent", alignItems: "center", justifyContent: "center" }}>
            {checked ? <Icon name="check" size={14} color={c.brandForeground} /> : null}
          </View>
        ) : null}
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text weight="500" numberOfLines={1} style={{ flexShrink: 1 }}>
              {r.name}
            </Text>
            {r.doNotContact ? <Icon name="slash" size={13} color={c.destructive} /> : null}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <StagePill stage={r.stage} />
            {scored ? <BandBadge band={r.band} score={r.score} /> : null}
            <Text variant="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
              {r.city || r.state || "—"}
              {scored ? ` · ${r.facts}/${FACT_COUNT} facts` : ""}
              {!r.hasPhone ? " · no phone" : ""}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4, maxWidth: 120 }}>
          {r.nextStepDate ? <DueChip date={r.nextStepDate} today={today} /> : null}
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {r.assigned || "Unassigned"}
          </Text>
        </View>
      </Pressable>
      <Divider inset={space.lg} />
    </View>
  );
});
