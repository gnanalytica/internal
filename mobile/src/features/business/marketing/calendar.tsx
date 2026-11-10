import { router, type Href } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { Button, Card, IconButton, Section, Text } from "@/components/ui";
import { useTheme } from "@/theme";

import { Bar, OptionBadge } from "../ui";
import { ChannelDot, chipMeta, STATUS_OPTIONS, statusColor, type Piece } from "./bits";
import { addDays, CHANNELS, dayLabel, dayOf, FORMATS, formatOf, channelOf, lateLabel, overdue as overdueOf, PIECE_STATUSES, rowOf, TONE_HEX, weekDays, weekLabel, weeklyPosted, weekPace, weekStart, type Tone } from "./model";

const OVERDUE_CAP = 5;
const WEEKS = 8;

/**
 * The content calendar, the way the web shows it on a phone: one week, a day
 * under another, then how the week is going against plan, what is overdue,
 * the ideas still waiting for a day, and how often each channel posts.
 */
export function CalendarView({
  items,
  today,
  refreshing,
  onRefresh,
  ownerName,
  salesHref,
  onOpen,
  onSchedule,
}: {
  items: Piece[];
  today: string;
  refreshing: boolean;
  onRefresh: () => void;
  ownerName: (id: string | null | undefined) => string | null;
  salesHref: Href | null;
  onOpen: (p: Piece) => void;
  onSchedule: (p: Piece) => void;
}) {
  const { c, space, radius } = useTheme();
  const [start, setStart] = useState(() => weekStart(today));
  const [allLate, setAllLate] = useState(false);
  const thisWeek = weekStart(today);

  const byDay = useMemo(() => {
    const days = new Set(weekDays(start));
    const m = new Map<string, Piece[]>();
    for (const p of items) {
      const d = dayOf(p.publishDate);
      if (d && days.has(d)) m.set(d, [...(m.get(d) ?? []), p]);
    }
    for (const list of m.values()) list.sort((a, b) => Date.parse(a.publishDate!) - Date.parse(b.publishDate!));
    return m;
  }, [items, start]);
  const pace = useMemo(() => weekPace(items, start), [items, start]);
  const late = useMemo(() => overdueOf(items, today), [items, today]);
  const ideas = useMemo(() => items.filter((p) => !p.publishDate), [items]);

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 112, gap: space.xl }}>
      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
          <IconButton icon="chevron-left" label="Previous week" onPress={() => setStart(addDays(start, -7))} />
          <IconButton icon="chevron-right" label="Next week" onPress={() => setStart(addDays(start, 7))} />
          <Text variant="title" style={{ flex: 1 }} accessibilityLiveRegion="polite">
            {weekLabel(start)}
          </Text>
          {start !== thisWeek ? <Button title="This week" size="sm" variant="ghost" onPress={() => setStart(thisWeek)} /> : null}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: space.md, rowGap: 4 }} accessibilityLabel="Status colours">
          {PIECE_STATUSES.map((s) => (
            <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: TONE_HEX[s.tone] }} />
              <Text variant="caption" tone="muted">
                {s.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ gap: space.md }}>
        {weekDays(start).map((d) => {
          const list = byDay.get(d) ?? [];
          return (
            <View key={d} style={{ gap: 6 }}>
              <Text variant="small" weight={d === today ? "600" : "400"} tone={d === today ? "brand" : "muted"}>
                {d === today ? `Today · ${dayLabel(d)}` : dayLabel(d)}
              </Text>
              {list.length ? (
                list.map((p) => {
                  const owner = ownerName(p.ownerId);
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => onOpen(p)}
                      accessibilityRole="button"
                      style={({ pressed }) => ({ borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 8, gap: 2, backgroundColor: `${statusColor(p.status)}24`, opacity: pressed ? 0.75 : 1 })}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <ChannelDot channel={p.channel} />
                        <Text variant="small" weight="600" numberOfLines={2} style={{ flex: 1 }}>
                          {p.title}
                        </Text>
                      </View>
                      <Text variant="caption" tone="muted" numberOfLines={1}>
                        {chipMeta(p, owner ? owner.split(/\s+/)[0] : null)}
                      </Text>
                    </Pressable>
                  );
                })
              ) : (
                <View style={{ borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderStyle: "dashed", borderColor: c.border, paddingHorizontal: 12, paddingVertical: 8 }}>
                  <Text variant="caption" tone="muted">
                    Nothing planned
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      <Section title={start === thisWeek ? "This week against plan" : `${weekLabel(start)} against plan`}>
        {pace.length === 0 ? (
          <Text variant="small" tone="muted">
            Nothing is dated this week yet. Schedule an idea, or give a piece a day.
          </Text>
        ) : (
          pace.map((r) => (
            <View key={r.channel} style={{ gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                <Text variant="small" style={{ flex: 1 }}>
                  {r.label}
                </Text>
                <Text variant="small" mono>
                  {r.done}
                </Text>
                <Text variant="caption" tone="muted">
                  of {r.plan} posted
                </Text>
              </View>
              <Bar value={r.plan ? r.done / r.plan : 0} color={TONE_HEX[r.tone]} />
            </View>
          ))
        )}
      </Section>

      <Card style={{ backgroundColor: c.muted, borderWidth: 0 }}>
        <Text weight="600">Leads from marketing</Text>
        <Text variant="small" tone="muted">
          The prospects sheet doesn’t record where a lead came from yet, so they can’t be counted here. When someone mentions a post, note it on their prospect.
        </Text>
        {salesHref ? <Button title="Open Sales" size="sm" variant="ghost" icon="arrow-right" style={{ alignSelf: "flex-start" }} onPress={() => router.push(salesHref)} /> : null}
      </Card>

      {late.length > 0 ? (
        <Section
          title="Overdue, not posted"
          action={
            <Text variant="small" mono style={{ color: TONE_HEX.orange }}>
              {late.length}
            </Text>
          }
        >
          <Text variant="caption" tone="muted">
            Their day has passed. Give each a new date, or send it back to the ideas.
          </Text>
          {(allLate ? late : late.slice(0, OVERDUE_CAP)).map((p) => (
            <Card key={p.id} onPress={() => onOpen(p)} style={{ paddingVertical: space.sm, paddingHorizontal: space.md, gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ChannelDot channel={p.channel} />
                <Text variant="small" weight="500" numberOfLines={1} style={{ flex: 1 }}>
                  {p.title}
                </Text>
                <OptionBadge list={STATUS_OPTIONS} value={p.status} />
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text variant="caption" weight="600" style={{ flex: 1, color: TONE_HEX.orange }}>
                  {lateLabel(p.publishDate, today)}
                </Text>
                <Button title="Reschedule…" size="sm" variant="ghost" onPress={() => onSchedule(p)} />
              </View>
            </Card>
          ))}
          {late.length > OVERDUE_CAP ? <Button title={allLate ? "Show fewer" : `Show all ${late.length}`} size="sm" variant="ghost" style={{ alignSelf: "flex-start" }} onPress={() => setAllLate(!allLate)} /> : null}
        </Section>
      ) : null}

      <Section
        title="Ideas, not scheduled"
        action={
          <Text variant="small" tone="muted" mono>
            {ideas.length}
          </Text>
        }
      >
        {ideas.length === 0 ? (
          <Text variant="small" tone="muted">
            Every piece has a date. Jot the next idea down with the + button.
          </Text>
        ) : (
          <>
            <Text variant="caption" tone="muted">
              Use Schedule… to give one a date.
            </Text>
            {ideas.map((p) => {
              const f = formatOf(p);
              return (
                <Card key={p.id} onPress={() => onOpen(p)} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4, paddingHorizontal: space.md }}>
                  <ChannelDot channel={p.channel} />
                  <Text variant="small" numberOfLines={1} style={{ flex: 1 }}>
                    {p.title}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {f ? FORMATS[f].label : (channelOf(p.channel)?.label ?? "")}
                  </Text>
                  <Button title="Schedule…" size="sm" variant="ghost" onPress={() => onSchedule(p)} />
                </Card>
              );
            })}
          </>
        )}
      </Section>

      <ChannelsSection items={items} today={today} />
    </ScrollView>
  );
}

/** How often each channel actually posts: the last eight weeks, then totals. The web's Channels, a row per channel. */
function ChannelsSection({ items, today }: { items: Piece[]; today: string }) {
  const { c, space } = useTheme();
  const last = weekStart(today);
  const weekly = weeklyPosted(items, last, WEEKS);
  const rows = [...CHANNELS.map((ch) => ({ id: ch.id as string, label: ch.label as string, tone: ch.tone as Tone })), { id: "other", label: "No channel", tone: "gray" as Tone }]
    .map((r) => {
      const mine = items.filter((p) => rowOf(p) === r.id);
      const posted = mine.filter((p) => p.status === "published");
      return {
        ...r,
        weeks: weekly.get(r.id) ?? Array<number>(WEEKS).fill(0),
        pieces: mine.length,
        posted: posted.length,
        views: posted.reduce((s, p) => s + (p.views ?? 0), 0),
        clicks: posted.reduce((s, p) => s + (p.clicks ?? 0), 0),
      };
    })
    .filter((r) => r.id !== "other" || r.pieces > 0);
  const max = Math.max(1, ...rows.flatMap((r) => r.weeks));
  const anyPosted = rows.some((r) => r.posted > 0);
  const n = (v: number) => (v ? v.toLocaleString("en-IN") : "—");

  return (
    <Section title="Channels">
      <Text variant="caption" tone="muted">
        Pieces marked Posted, by the week they went out (last eight weeks). Views and clicks are what was typed in on each piece.
      </Text>
      {!anyPosted ? (
        <Text variant="small" tone="muted">
          Nothing is marked Posted yet. Once a piece goes out, set it to Posted and it counts here.
        </Text>
      ) : null}
      <Card style={{ padding: 0, gap: 0 }}>
        {rows.map((r, i) => (
          <View key={r.id} style={{ flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.md, paddingVertical: space.sm, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: c.border }}>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <ChannelDot channel={r.id === "other" ? null : r.id} />
                <Text variant="small" weight="500" numberOfLines={1}>
                  {r.label}
                </Text>
              </View>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {r.posted} / {r.pieces} posted · {n(r.views)} views · {n(r.clicks)} clicks
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height: 24 }} accessibilityLabel={`${r.label}: ${r.weeks.reduce((s, v) => s + v, 0)} posted in ${WEEKS} weeks`}>
              {r.weeks.map((v, w) => (
                <View key={w} style={{ width: 5, height: v ? Math.max(5, Math.round((v / max) * 24)) : 2, borderRadius: 1, backgroundColor: v ? TONE_HEX[r.tone] : c.muted }} />
              ))}
            </View>
            <Text variant="small" mono style={{ width: 24, textAlign: "right" }}>
              {r.weeks.reduce((s, v) => s + v, 0)}
            </Text>
          </View>
        ))}
      </Card>
    </Section>
  );
}
