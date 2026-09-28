import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";

import { Button, Card, Divider, ErrorView, Loading, Row, Screen, Segmented, Text } from "@/components/ui";
import { useTheme } from "@/theme";

import { assignToMe, overviewQuery, type Scope } from "./api";
import { BandBadge, Bar, fail, notify } from "./bits";
import { KIND_LABEL, UNSCORED_KINDS, WRITABLE, type Period, type ProspectKind } from "./model";
import { openRecord } from "./my-work";

function Kpi({ label, value, note, bad }: { label: string; value: string | number; note?: string; bad?: boolean }) {
  const { c, space, radius } = useTheme();
  return (
    <View style={{ width: "48.5%", backgroundColor: c.card, borderRadius: radius.lg, borderWidth: 0.5, borderColor: c.border, paddingHorizontal: space.md, paddingVertical: space.sm + 2, gap: 2 }}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="heading" mono>
        {value}
      </Text>
      {note ? (
        <Text variant="caption" tone={bad ? "danger" : "muted"} weight={bad ? "600" : undefined}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

/** A label, a bar and the figure — the web's meter rows. */
function Meter({ label, value, max, figure }: { label: string; value: number; max: number; figure: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 26 }}>
      <Text variant="small" numberOfLines={1} style={{ width: 128 }}>
        {label}
      </Text>
      <Bar value={value} max={max} />
      <Text variant="small" mono style={{ minWidth: 56, textAlign: "right" }}>
        {figure}
      </Text>
    </View>
  );
}

function Title({ text, aside }: { text: string; aside?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
      <Text weight="600" style={{ flex: 1 }}>
        {text}
      </Text>
      {aside ? (
        <Text variant="caption" tone="muted">
          {aside}
        </Text>
      ) : null}
    </View>
  );
}

/** The web's Overview, as the cards that read well on a phone. */
export function OverviewView({ kind, scope, header, onGotoList, onGotoPlaybook }: { kind: ProspectKind; scope: Scope; header: React.ReactElement; onGotoList: (view: string) => void; onGotoPlaybook: (section: string) => void }) {
  const { c, space } = useTheme();
  const [who, setWho] = useState<"team" | "me">("team");
  const [period, setPeriod] = useState<Period>("week");
  const [taking, setTaking] = useState<string | null>(null);
  const q = useQuery(overviewQuery(kind, scope, period, who));
  const periodWord = period === "week" ? "last 7 days" : period === "month" ? "last 30 days" : "since the start";
  const noun = KIND_LABEL[kind].many.toLowerCase();

  const take = async (k: ProspectKind, id: string) => {
    setTaking(id);
    try {
      notify((await assignToMe(k, [id])).message);
    } catch (e) {
      fail("Couldn't assign", e);
    } finally {
      setTaking(null);
    }
  };

  const controls = (
    <View style={{ gap: space.sm }}>
      <Segmented value={who} onChange={setWho} options={[{ value: "team", label: "Team" }, { value: "me", label: "Me" }]} />
      <Segmented value={period} onChange={setPeriod} options={[{ value: "week", label: "7 days" }, { value: "month", label: "30 days" }, { value: "all", label: "All time" }]} />
    </View>
  );

  if (q.isPending)
    return (
      <Screen padded={false}>
        {header}
        <View style={{ paddingHorizontal: space.lg }}>{controls}</View>
        <Loading />
      </Screen>
    );
  if (q.isError)
    return (
      <Screen padded={false}>
        {header}
        <ErrorView error={q.error} onRetry={() => void q.refetch()} />
      </Screen>
    );

  const o = q.data.data;
  const maxFunnel = Math.max(1, ...o.funnel.map((f) => f.count));
  return (
    <Screen padded={false} refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      {header}
      <View style={{ paddingHorizontal: space.lg, gap: space.lg }}>
        {controls}
        <Text variant="small" tone="muted">
          {o.total.toLocaleString("en-IN")} {noun} in view
        </Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: space.sm }}>
          <Kpi label="Touches" value={o.kpis.touches} note={periodWord} />
          <Kpi label="Reply / connect rate" value={o.hasActivity ? `${o.kpis.engagedRate}%` : "—"} note="of outbound touches" />
          <Kpi label="Due today" value={o.kpis.dueToday} note={o.kpis.overdue ? `${o.kpis.overdue} overdue` : "none overdue"} bad={o.kpis.overdue > 0} />
          <Kpi label="Demos booked" value={o.kpis.demosBooked} note={periodWord} />
          <Kpi label="Pilots running" value={o.kpis.pilots} note="1–2 live cases each" />
          <Kpi label="Won" value={o.kpis.won} />
        </View>

        <Card>
          <Title text={`Where every ${KIND_LABEL[kind].one.toLowerCase()} stands`} aside="count · moves on" />
          {o.funnel.map((f) => (
            <View key={f.stage} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 26 }}>
              <Text variant="small" style={{ width: 108 }} numberOfLines={1}>
                {f.stage}
              </Text>
              <Bar value={f.count} max={maxFunnel} height={10} />
              <Text variant="small" mono style={{ minWidth: 44, textAlign: "right" }}>
                {f.count.toLocaleString("en-IN")}
              </Text>
              <Text variant="caption" tone="muted" mono style={{ width: 34, textAlign: "right" }}>
                {f.movedOn === null ? "" : `${f.movedOn}%`}
              </Text>
            </View>
          ))}
        </Card>

        <Card>
          <Title text="Which channel gets replies" aside={periodWord} />
          {o.hasActivity ? (
            <>
              {o.channels.map((ch) => (
                <Meter key={ch.channel} label={`${ch.channel} · ${ch.engaged}/${ch.outbound}`} value={ch.rate} max={100} figure={ch.outbound ? `${ch.rate}%` : "—"} />
              ))}
              <Text variant="caption" tone="muted">
                Calls logged: {o.calls.count}
                {o.calls.avgMinutes !== null ? ` · average ${o.calls.avgMinutes} min` : ""}
              </Text>
            </>
          ) : (
            <Text variant="small" tone="muted">
              Nothing logged yet. Every call or message logged from a record lands in the sheet&apos;s Activity tab, and these rates fill in from it.
            </Text>
          )}
        </Card>

        {kind === "valuer" ? (
          <Card>
            <Title text="Sprint · contacted of target" />
            {o.sprint.map((s) => (
              <Meter key={s.label} label={s.label} value={s.contacted} max={s.target} figure={`${s.contacted}/${s.target}`} />
            ))}
            <Text variant="caption" tone="muted">
              Top {o.top25.size} A-band contacted: {o.top25.contacted}
            </Text>
          </Card>
        ) : null}

        <Card>
          <Title text="A-band, nobody assigned" aside="pick them up" />
          {o.unassignedA.length ? (
            o.unassignedA.map((r, i) => (
              <View key={r.id}>
                {i > 0 ? <Divider /> : null}
                <Row
                  style={{ paddingHorizontal: 0, backgroundColor: "transparent" }}
                  title={r.name}
                  subtitle={`${r.city || r.state}${r.pitchAngle ? ` · ${r.pitchAngle}` : ""}`}
                  leading={<BandBadge band={r.band} score={r.score} />}
                  trailing={<Button size="sm" title="Take" loading={taking === r.id} disabled={!!taking} onPress={() => void take(r.kind, r.id)} />}
                  onPress={() => openRecord(r.kind, r.id)}
                />
              </View>
            ))
          ) : (
            <Text variant="small" tone="muted">
              None right now. A-band rows appear here once the research agents score them.
            </Text>
          )}
        </Card>

        <Card>
          <Title text="The team" aside={periodWord} />
          {o.team.length ? (
            o.team.map((t, i) => (
              <View key={t.person} style={{ gap: 2, paddingTop: i ? space.sm : 0, borderTopWidth: i ? 0.5 : 0, borderTopColor: c.border }}>
                <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                  <Text weight="600" style={{ flex: 1 }}>
                    {t.person}
                  </Text>
                  {t.overdue ? (
                    <Text variant="small" tone="danger" weight="600">
                      {t.overdue} overdue
                    </Text>
                  ) : null}
                </View>
                <Text variant="small" tone="muted" mono>
                  {t.assigned} assigned · {t.touches} touches · {t.calls} calls · {t.touches ? `${t.engagedRate}% reply` : "— reply"} · {t.demos} demo · {t.pilots} pilot
                </Text>
              </View>
            ))
          ) : (
            <Text variant="small" tone="muted">
              No one is assigned anything yet. Assign rows from a record or the List.
            </Text>
          )}
        </Card>

        {kind === "valuer" || kind === "firm" ? (
          <Card>
            <Title text="Pitch that books demos" aside="discovery → demo" />
            {o.pitch.some((p) => p.discovered) ? (
              o.pitch.map((p) => <Meter key={p.angle} label={p.angle} value={p.rate} max={100} figure={p.discovered ? `${p.rate}% of ${p.discovered}` : "—"} />)
            ) : (
              <Text variant="small" tone="muted">
                Fills in once records with a pitch angle reach Discovery done.
              </Text>
            )}
          </Card>
        ) : null}

        <Card>
          <Title text="Top objections" />
          {o.objections.length ? (
            o.objections.slice(0, 6).map((x) => <Meter key={x.objection} label={x.objection} value={x.count} max={o.objections[0].count} figure={String(x.count)} />)
          ) : (
            <Text variant="small" tone="muted">
              Objections recorded on calls show up here.
            </Text>
          )}
          <Button size="sm" variant="ghost" title="How to answer them" icon="book-open" style={{ alignSelf: "flex-start" }} onPress={() => onGotoPlaybook("objections")} />
        </Card>

        <Card>
          <Title text="What we know" aside={`of ${o.total.toLocaleString("en-IN")}`} />
          {o.coverage
            .filter((cv) => !UNSCORED_KINDS.has(kind) || cv.label === "Phone" || cv.label === "Email" || (cv.label === "Lenders" && WRITABLE[kind].has("lenders_empanelled_with")))
            .map((cv) => (
              <Meter key={cv.label} label={cv.label} value={cv.pct} max={100} figure={`${cv.pct}%`} />
            ))}
          {!UNSCORED_KINDS.has(kind) ? <Button size="sm" variant="ghost" title="See rows missing facts" icon="arrow-right" style={{ alignSelf: "flex-start" }} onPress={() => onGotoList("gaps")} /> : null}
        </Card>

        <Card>
          <Title text="Research agents" />
          {o.research.map((r) => (
            <View key={r.label} style={{ flexDirection: "row", justifyContent: "space-between", minHeight: 22 }}>
              <Text variant="small">{r.label}</Text>
              <Text variant="small" mono>
                {r.count.toLocaleString("en-IN")}
              </Text>
            </View>
          ))}
          <Button size="sm" variant="ghost" title="Review scored" icon="arrow-right" style={{ alignSelf: "flex-start" }} onPress={() => onGotoList("review")} />
        </Card>
      </View>
    </Screen>
  );
}
