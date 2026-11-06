"use client";

import { useMemo, useState } from "react";

import type { ActivityEntry } from "@/lib/prospects/parse";
import { KIND_LABEL, PROSPECT_KINDS, type Channel, type ProspectKind } from "@/lib/prospects/schema";
import { tone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { buildOverview, type Period, type ProspectRow } from "@/lib/prospects/stats";
import { Bar, Card, CHANNEL_TONE, Empty, FilterMenu, PATH, Segmented, StageDot, stageTone } from "./bits";

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
  const maxFunnel = Math.max(1, ...o.funnel.map((f) => f.count));
  const periodWord = period === "week" ? "last 7 days" : period === "month" ? "last 30 days" : "since logging started";

  return (
    <div className="flex max-w-5xl flex-col gap-8">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="Period" value={period} onChange={setPeriod} options={[{ value: "week", label: "7 days" }, { value: "month", label: "30 days" }, { value: "all", label: "All time" }]} />
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
