"use client";

import { useMemo, useState } from "react";

import type { ActivityEntry } from "@/lib/prospects/parse";
import { KIND_LABEL, PROSPECT_KINDS, type Channel, type ProspectKind } from "@/lib/prospects/schema";
import { tone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { buildOverview, periodWords, type Period, type ProspectRow } from "@/lib/prospects/stats";
import { Bar, Card, CHANNEL_TONE, Empty, FilterMenu, PATH, Segmented, StageDot, stageTone } from "./bits";
import { DateRangePicker } from "./date-range-picker";
import { Columns, SegmentedBar, StackedColumns, StackedRows, type Series } from "./insight-charts";
import { buildInsightCharts, CHART_CHANNELS, OUTCOME_CLASSES } from "@/lib/prospects/insights";

type Preset = "today" | "week" | "month";

/** Channel colours for charts: one step darker than the chips so every mark clears 3:1 on the page, validated for colour-blind separation in both themes. */
const CHANNEL_SERIES: Series[] = CHART_CHANNELS.map((c) => ({
  key: c,
  label: c,
  swatch: { WhatsApp: "bg-emerald-600", Email: "bg-violet-600 dark:bg-violet-500", Call: "bg-sky-600", LinkedIn: "bg-indigo-600 dark:bg-indigo-500", Meeting: "bg-amber-600" }[c],
}));

/** How touches went. Status-like colours, always named in the legend. */
const OUTCOME_SERIES: Series[] = OUTCOME_CLASSES.map((k) => ({
  key: k,
  label: k === "Waiting" ? "Sent, no reply yet" : k === "Closed" ? "Not interested" : k,
  swatch: { Engaged: "bg-emerald-600", Waiting: "bg-zinc-300 dark:bg-zinc-600", "No answer": "bg-amber-500", Closed: "bg-red-600" }[k],
}));

const FOLLOW_UP_STYLE: Record<string, { swatch: string; ink: string }> = {
  Overdue: { swatch: "bg-red-600", ink: "text-white" },
  "Due today": { swatch: "bg-amber-500", ink: "text-zinc-950" },
  "Next 7 days": { swatch: "bg-indigo-600", ink: "text-white" },
  Later: { swatch: "bg-indigo-300 dark:bg-indigo-400", ink: "text-zinc-950" },
  "No date": { swatch: "bg-zinc-300 dark:bg-zinc-600", ink: "text-zinc-900 dark:text-zinc-100" },
};

const DAY = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const WEEKDAY = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const fmt = (iso: string, f: Intl.DateTimeFormat) => f.format(new Date(`${iso}T00:00:00Z`));

function Kpi({ label, value, note, tone }: { label: string; value: React.ReactNode; note?: string; tone?: "bad" }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3.5 sm:px-5">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="text-2xl font-medium tracking-tight tabular-nums sm:text-[28px]">{value}</span>
      {note && <span className={tone === "bad" ? "text-xs text-red-700 dark:text-red-400" : "text-xs text-muted-foreground"}>{note}</span>}
    </div>
  );
}

/** How outreach is going: a handful of numbers, the funnel, and what is working. */
export function Overview({ rows, activity, today, me, team, onGotoPlaybook }: { rows: ProspectRow[]; activity: ActivityEntry[]; today: string; me: string; team: string[]; onGotoPlaybook: (section: string) => void }) {
  const [who, setWho] = useState<"team" | "me">("team");
  const [period, setPeriod] = useState<Period>("week");
  const [kind, setKind] = useState<ProspectKind | "">("");
  const scoped = useMemo(() => (kind ? rows.filter((r) => r.kind === kind) : rows), [rows, kind]);
  const o = useMemo(() => buildOverview({ rows: scoped, activity, today, period, person: who === "me" ? me : null, team }), [scoped, activity, today, period, who, me, team]);
  const charts = useMemo(() => buildInsightCharts({ rows: scoped, activity, today, period, person: who === "me" ? me : null }), [scoped, activity, today, period, who, me]);
  const contactedOpen = charts.followUp.reduce((s, p) => s + p.count, 0);
  const maxFunnel = Math.max(1, ...o.funnel.map((f) => f.count));
  const periodWord = periodWords(period);
  const preset = typeof period === "string" ? (period as Preset) : ("" as Preset);

  return (
    <div className="flex max-w-5xl flex-col gap-8">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="Period" value={preset} onChange={setPeriod} options={[{ value: "today", label: "Today" }, { value: "week", label: "7 days" }, { value: "month", label: "30 days" }]} />
        <DateRangePicker value={typeof period === "object" ? period : null} today={today} onChange={setPeriod} />
        <Segmented label="Whose numbers" value={who} onChange={setWho} options={[{ value: "team", label: "Team" }, { value: "me", label: "Me" }]} />
        <FilterMenu label="Type" value={kind} onChange={(v) => setKind(v as ProspectKind | "")} options={[{ value: "", label: "All" }, ...PROSPECT_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k].many }))]} />
      </div>

      <div className="grid grid-cols-2 divide-border rounded-xl border sm:grid-cols-4 sm:divide-x max-sm:[&>*:nth-child(n+3)]:border-t max-sm:[&>*:nth-child(even)]:border-l">
        <Kpi label="Touches" value={o.kpis.touches} note={periodWord} />
        <Kpi label="Reply or connect rate" value={o.hasActivity ? `${o.kpis.engagedRate}%` : "—"} note="of outbound touches" />
        <Kpi label="Demos booked" value={o.kpis.demosBooked} note={o.kpis.overdue ? `${o.kpis.overdue} follow-up${o.kpis.overdue === 1 ? "" : "s"} overdue` : periodWord} tone={o.kpis.overdue ? "bad" : undefined} />
        <Kpi label="Pilots running" value={o.kpis.pilots} note={o.kpis.won ? `${o.kpis.won} won` : "goal: 1–2 live cases each"} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-10">
        <Card title={charts.touches?.unit === "week" ? "Touches per week" : "Touches per day"} aside={periodWord}>
          {!charts.touches ? (
            <Empty>Pick 7 days, 30 days or a date range to see touches over time.</Empty>
          ) : charts.touches.buckets.every((b) => !b.total) ? (
            <Empty>No touches logged {periodWord}.</Empty>
          ) : (
            <StackedColumns
              // A new period is a new chart: no readout carried over from the last one.
              key={periodWord}
              label={`Touches per ${charts.touches.unit}, by channel, ${periodWord}`}
              series={CHANNEL_SERIES}
              columns={charts.touches.buckets.map((b) => ({
                key: b.from,
                label: fmt(b.from, DAY),
                title: charts.touches!.unit === "week" ? `Week of ${fmt(b.from, DAY)}` : fmt(b.from, WEEKDAY),
                values: b.byChannel,
                total: b.total,
              }))}
            />
          )}
        </Card>
        <Card title="How touches went" aside={periodWord}>
          {charts.outcomes.length ? (
            <StackedRows
              label={`Outcomes by channel, ${periodWord}`}
              series={OUTCOME_SERIES}
              rows={charts.outcomes.map((r) => ({
                key: r.channel,
                name: r.channel,
                total: r.total,
                values: r.byClass,
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className={cn("size-[7px] rounded-full", tone(CHANNEL_TONE[r.channel as Channel] ?? "gray").dot)} />
                    {r.channel}
                  </span>
                ),
              }))}
            />
          ) : (
            <Empty>Nothing logged {periodWord}.</Empty>
          )}
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-10">
        <Card title="Follow-ups on contacted prospects" aside={`now · ${contactedOpen.toLocaleString("en-IN")} open`}>
          {contactedOpen ? (
            <SegmentedBar label="Follow-up state of contacted, open prospects" parts={charts.followUp.map((p) => ({ key: p.part, label: p.part, value: p.count, ...FOLLOW_UP_STYLE[p.part] }))} />
          ) : (
            <Empty>No contacted prospects are open right now.</Empty>
          )}
        </Card>
        <Card title="Days since last contact" aside="now · contacted, open">
          {charts.staleness.some((b) => b.count) ? (
            <Columns label="Contacted open prospects by days since last contact" unit="days" swatch="bg-indigo-500" data={charts.staleness.map((b) => ({ label: b.label, value: b.count }))} />
          ) : (
            <Empty>No contacted prospects are open right now.</Empty>
          )}
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-10">
        <Card title="Funnel" aside={`${o.total.toLocaleString("en-IN")} prospects`}>
          <div className="flex flex-col gap-1">
            {o.funnel
              .filter((f) => (PATH as readonly string[]).includes(f.stage))
              .map((f, i) => (
                <div key={f.stage} className="grid grid-cols-[124px_1fr_56px_40px] items-center gap-3 py-1 text-[13px]">
                  <span className="inline-flex items-center gap-1.5">
                    <StageDot stage={i} /> {f.stage}
                  </span>
                  <Bar value={f.count} max={maxFunnel} fill={stageTone(i).bar} />
                  <span className="text-right font-mono text-xs tabular-nums">{f.count.toLocaleString("en-IN")}</span>
                  <span className="text-right font-mono text-[11px] text-muted-foreground tabular-nums" title="Share that moved on to the next stage">
                    {f.movedOn === null ? "" : `${f.movedOn}%`}
                  </span>
                </div>
              ))}
          </div>
        </Card>
        <Card title="Which channel gets replies" aside={periodWord}>
          {o.hasActivity ? (
            <div className="flex flex-col gap-1">
              {o.channels.map((c) => (
                <div key={c.channel} className="grid grid-cols-[84px_1fr_88px] items-center gap-3 py-1 text-[13px]">
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className={cn("size-[7px] rounded-full", tone(CHANNEL_TONE[c.channel as Channel] ?? "gray").dot)} />
                    {c.channel}
                  </span>
                  <Bar value={c.rate} max={100} fill={tone(CHANNEL_TONE[c.channel as Channel] ?? "gray").bar} />
                  <span className="text-right font-mono text-xs text-muted-foreground tabular-nums">{c.outbound ? `${c.engaged}/${c.outbound} · ${c.rate}%` : "—"}</span>
                </div>
              ))}
              {o.calls.count > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {o.calls.count} call{o.calls.count === 1 ? "" : "s"} logged{o.calls.avgMinutes !== null ? `, ${o.calls.avgMinutes} min on average` : ""}.
                </p>
              )}
            </div>
          ) : (
            <Empty>Nothing logged yet. Rates fill in from the touches people log.</Empty>
          )}
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-10">
        <Card title="Who is doing the work" aside={periodWord}>
          {o.team.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-1.5 pr-2 font-normal">Person</th>
                    <th className="px-2 text-right font-normal">Assigned</th>
                    <th className="px-2 text-right font-normal">Touches</th>
                    <th className="px-2 text-right font-normal">Reply %</th>
                    <th className="px-2 text-right font-normal">Overdue</th>
                    <th className="pl-2 text-right font-normal">Demos</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {o.team.map((t) => (
                    <tr key={t.person} className="h-9 border-b border-border/60">
                      <td className="pr-2">{t.person}</td>
                      <td className="px-2 text-right">{t.assigned}</td>
                      <td className="px-2 text-right">{t.touches}</td>
                      <td className="px-2 text-right">{t.touches ? `${t.engagedRate}%` : "—"}</td>
                      <td className={t.overdue ? "px-2 text-right text-red-700 dark:text-red-400" : "px-2 text-right text-muted-foreground"}>{t.overdue}</td>
                      <td className="pl-2 text-right">{t.demos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No one is assigned anything yet. Assign prospects from a record or the list.</Empty>
          )}
        </Card>
        <Card
          title="Top objections"
          aside={
            <button type="button" className="hover:text-foreground" onClick={() => onGotoPlaybook("objections")}>
              How to answer →
            </button>
          }
        >
          {o.objections.length ? (
            <div className="flex flex-col gap-1">
              {o.objections.slice(0, 6).map((x) => (
                <div key={x.objection} className="grid grid-cols-[1fr_80px_24px] items-center gap-3 py-1 text-[13px]">
                  <span className="truncate">{x.objection}</span>
                  <Bar value={x.count} max={o.objections[0].count} />
                  <span className="text-right font-mono text-xs tabular-nums">{x.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty>None logged yet. When someone picks an objection in the log, it shows here.</Empty>
          )}
        </Card>
      </div>

      <div className="grid gap-8 border-t pt-8 md:grid-cols-3 md:gap-10">
        {(kind === "" || kind === "valuer") && (
          <Card title="Sprint" aside="contacted of target">
            <div className="flex flex-col gap-1">
              {o.sprint.map((s) => (
                <div key={s.label} className="grid grid-cols-[96px_1fr_52px] items-center gap-2 py-1 text-xs">
                  <span>{s.label}</span>
                  <Bar value={s.contacted} max={s.target} className="h-1.5" />
                  <span className="text-right font-mono tabular-nums">
                    {s.contacted}/{s.target}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
        <Card title="Pitch that books demos">
          {o.pitch.some((p) => p.discovered) ? (
            <div className="flex flex-col gap-1">
              {o.pitch.map((p) => (
                <div key={p.angle} className="grid grid-cols-[1fr_56px_64px] items-center gap-2 py-1 text-xs">
                  <span className="truncate">{p.angle}</span>
                  <Bar value={p.rate} max={100} className="h-1.5" />
                  <span className="text-right font-mono text-muted-foreground tabular-nums">{p.discovered ? `${p.rate}% of ${p.discovered}` : "—"}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">Fills in once prospects with a pitch angle reach Discovery done.</p>
          )}
        </Card>
        <Card title="What research knows" aside={`of ${o.total.toLocaleString("en-IN")}`}>
          <div className="flex flex-col gap-1">
            {o.coverage.map((c) => (
              <div key={c.label} className="grid grid-cols-[96px_1fr_36px] items-center gap-2 py-1 text-xs">
                <span>{c.label}</span>
                <Bar value={c.pct} max={100} className="h-1.5" />
                <span className="text-right font-mono tabular-nums">{c.pct}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
