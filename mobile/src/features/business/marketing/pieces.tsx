import { useMemo } from "react";
import { FlatList, View } from "react-native";

import { Card, Divider, Row, Segmented, Text } from "@/components/ui";
import { useTheme } from "@/theme";

import { OptionBadge } from "../ui";
import { ChannelDot, STATUS_OPTIONS, type Piece } from "./bits";
import { CONTENT_FORMATS, dayLabel, dayOf, FORMATS, formatChannelLabel, formatOf, isOverdue, lateLabel, timeOf, TONE_HEX, type ContentFormat } from "./model";

/** A format, every piece (""), or the pieces whose day went by unposted. Same filters as the web's All pieces. */
export type PieceFilter = ContentFormat | "" | "overdue";

function goesOut(p: Piece): string {
  const d = dayOf(p.publishDate);
  return d ? `${dayLabel(d)} · ${timeOf(p.publishDate)}` : "No date";
}

/** Every piece in one list, filtered by format or to the overdue ones, each opening its editor. */
export function PiecesView({
  items,
  today,
  filter,
  setFilter,
  refreshing,
  onRefresh,
  onOpen,
}: {
  items: Piece[];
  today: string;
  filter: PieceFilter;
  setFilter: (f: PieceFilter) => void;
  refreshing: boolean;
  onRefresh: () => void;
  onOpen: (p: Piece) => void;
}) {
  const { c, space } = useTheme();
  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const p of items) {
      const f = formatOf(p);
      if (f) c.set(f, (c.get(f) ?? 0) + 1);
    }
    return c;
  }, [items]);
  const late = useMemo(() => new Set(items.filter((p) => isOverdue(p, today)).map((p) => p.id)), [items, today]);
  const shown = filter === "overdue" ? items.filter((p) => late.has(p.id)) : filter ? items.filter((p) => formatOf(p) === filter) : items;
  const emptyText =
    items.length === 0
      ? "No pieces yet. Use the + button to add the first one — a title is enough to start."
      : filter === "overdue"
        ? "Nothing is overdue. Every dated piece has gone out or is still to come."
        : `No ${FORMATS[filter as ContentFormat]?.plural.toLowerCase()} yet. Use the + button while this filter is on to start one.`;
  const options: { value: PieceFilter; label: string }[] = [
    { value: "", label: `All ${items.length}` },
    ...CONTENT_FORMATS.map((f) => ({ value: f as PieceFilter, label: `${FORMATS[f].plural} ${counts.get(f) ?? 0}` })),
    { value: "overdue", label: `Overdue ${late.size}` },
  ];

  return (
    <FlatList
      data={shown}
      keyExtractor={(p) => p.id}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListHeaderComponent={
        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
          <Segmented value={filter} onChange={setFilter} options={options} />
        </View>
      }
      ItemSeparatorComponent={() => <Divider inset={space.lg} />}
      renderItem={({ item: p }) => (
        <Row
          leading={<ChannelDot channel={p.channel} />}
          title={p.title}
          subtitle={
            <Text variant="small" tone="muted" numberOfLines={1}>
              {formatChannelLabel(p)} ·{" "}
              <Text variant="small" mono style={late.has(p.id) ? { color: TONE_HEX.orange } : undefined}>
                {goesOut(p)}
              </Text>
              {late.has(p.id) ? <Text variant="small" weight="600" style={{ color: TONE_HEX.orange }}>{` · ${lateLabel(p.publishDate, today)}`}</Text> : null}
            </Text>
          }
          trailing={<OptionBadge list={STATUS_OPTIONS} value={p.status} />}
          onPress={() => onOpen(p)}
        />
      )}
      ListEmptyComponent={
        <Text tone="muted" style={{ textAlign: "center", padding: space.xl }}>
          {emptyText}
        </Text>
      }
      ListFooterComponent={
        <View style={{ padding: space.lg, paddingBottom: 112 }}>
          <Card style={{ borderWidth: 0, backgroundColor: c.muted }}>
            <Text weight="600">What each format asks for</Text>
            {CONTENT_FORMATS.map((f) => (
              <Text key={f} variant="small" tone="muted">
                <Text variant="small" weight="600">
                  {FORMATS[f].label}
                </Text>{" "}
                · {FORMATS[f].asks}
              </Text>
            ))}
          </Card>
        </View>
      }
    />
  );
}
