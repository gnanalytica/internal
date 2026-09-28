"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { assignToMe } from "@/lib/prospects/actions";
import type { ActivityEntry } from "@/lib/prospects/parse";
import { KIND_LABEL, UNSCORED_KINDS, WRITABLE, type ProspectKind } from "@/lib/prospects/schema";
import { buildOverview, type Period, type ProspectRow } from "@/lib/prospects/stats";
import { BandBadge, Bar, Card, Empty, Segmented } from "./bits";

function Kpi({ label, value, note, tone }: { label: string; value: React.ReactNode; note?: string; tone?: "bad" }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border bg-card px-4 py-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-2xl font-medium tabular-nums">{value}</span>
      {note && <span className={tone === "bad" ? "text-[11px] font-medium text-red-700 dark:text-red-400" : "text-[11px] text-muted-foreground"}>{note}</span>}
    </div>
  );
}

export function Overview({
  kind,
  rows,
  activity,
  today,
  me,
  team,
  onOpen,
  onGotoList,
  onGotoPlaybook,
}: {
  kind: ProspectKind;
  rows: ProspectRow[];
  activity: ActivityEntry[];
  today: string;
  me: string;
  team: string[];
  onOpen: (r: ProspectRow) => void;
  onGotoList: (view: string) => void;
  onGotoPlaybook: (section: string) => void;
}) {
  const [who, setWho] = useState<"team" | "me">("team");
  const [period, setPeriod] = useState<Period>("week");
  const [pending, start] = useTransition();
  const o = useMemo(() => buildOverview({ rows, activity, today, period, person: who === "me" ? me : null, team }), [rows, activity, today, period, who, me, team]);
  const maxFunnel = Math.max(1, ...o.funnel.map((f) => f.count));
  const periodWord = period === "week" ? "last 7 days" : period === "month" ? "last 30 days" : "since the start";
  const noun = KIND_LABEL[kind].many.toLowerCase();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="Whose numbers" value={who} onChange={setWho} options={[{ value: "team", label: "Team" }, { value: "me", label: "Me" }]} />
        <Segmented label="Period" value={period} onChange={setPeriod} options={[{ value: "week", label: "7 days" }, { value: "month", label: "30 days" }, { value: "all", label: "All time" }]} />
        <span className="text-xs text-muted-foreground">
          {o.total.toLocaleString("en-IN")} {noun} in view
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Touches" value={o.kpis.touches} note={periodWord} />
        <Kpi label="Reply / connect rate" value={o.hasActivity ? `${o.kpis.engagedRate}%` : "—"} note="of outbound touches" />
        <Kpi label="Due today" value={o.kpis.dueToday} note={o.kpis.overdue ? `${o.kpis.overdue} overdue` : "none overdue"} tone={o.kpis.overdue ? "bad" : undefined} />
        <Kpi label="Demos booked" value={o.kpis.demosBooked} note={periodWord} />
        <Kpi label="Pilots running" value={o.kpis.pilots} note="1–2 live cases each" />
        <Kpi label="Won" value={o.kpis.won} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card title={`Where every ${KIND_LABEL[kind].one.toLowerCase()} stands`} aside="count · share that moves on">
          <div className="flex flex-col gap-1.5">
            {o.funnel.map((f) => (
              <div key={f.stage} className="grid grid-cols-[112px_1fr_48px_44px] items-center gap-3 text-[13px]">
                <span>{f.stage}</span>
                <Bar value={f.count} max={maxFunnel} className="h-3.5" />
                <span className="text-right font-mono tabular-nums">{f.count.toLocaleString("en-IN")}</span>
                <span className="text-right font-mono text-[11px] text-muted-foreground tabular-nums">{f.movedOn === null ? "" : `${f.movedOn}%`}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Which channel gets replies" aside={periodWord}>
          {o.hasActivity ? (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-[80px_44px_44px_1fr_40px] gap-2 text-[11px] text-muted-foreground">
                <span />
                <span className="text-right">Sent</span>
                <span className="text-right">Engaged</span>
                <span />
                <span className="text-right">Rate</span>
              </div>
              {o.channels.map((c) => (
                <div key={c.channel} className="grid grid-cols-[80px_44px_44px_1fr_40px] items-center gap-2 text-[13px]">
                  <span>{c.channel}</span>
                  <span className="text-right font-mono tabular-nums">{c.outbound}</span>
                  <span className="text-right font-mono tabular-nums">{c.engaged}</span>
                  <Bar value={c.rate} max={100} />
                  <span className="text-right font-mono tabular-nums">{c.outbound ? `${c.rate}%` : "—"}</span>
                </div>
              ))}
              <p className="border-t pt-2 text-xs text-muted-foreground">
                Calls logged: <strong className="font-mono text-foreground">{o.calls.count}</strong>
                {o.calls.avgMinutes !== null && (
                  <>
                    {" "}
                    · average <strong className="font-mono text-foreground">{o.calls.avgMinutes} min</strong>
                  </>
                )}
              </p>
            </div>
          ) : (
            <Empty>Nothing logged yet. Every call or message logged from a record lands in the sheet&apos;s Activity tab, and these rates fill in from it.</Empty>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {kind === "valuer" && (
          <Card title="Sprint · contacted of target">
            {o.sprint.map((s) => (
              <div key={s.label} className="grid grid-cols-[110px_1fr_56px] items-center gap-2 text-[13px]">
                <span>{s.label}</span>
                <Bar value={s.contacted} max={s.target} className="h-2.5" />
                <span className="text-right font-mono tabular-nums">
                  {s.contacted}/{s.target}
                </span>
              </div>
            ))}
            <p className="border-t pt-2 text-xs text-muted-foreground">
              Top {o.top25.size} A-band contacted: <strong className="font-mono text-foreground">{o.top25.contacted}</strong>
              <br />
              In the list: {o.sprint.map((s) => `${s.label} ${s.inList}`).join(" · ")}
            </p>
          </Card>
        )}
        {(kind === "valuer" || kind === "firm") && (
          <Card title="Pitch that books demos" aside="discovery → demo">
            {o.pitch.some((p) => p.discovered) ? (
              o.pitch.map((p) => (
                <div key={p.angle} className="grid grid-cols-[150px_1fr_64px] items-center gap-2 text-xs">
                  <span>{p.angle}</span>
                  <Bar value={p.rate} max={100} />
                  <span className="text-right font-mono tabular-nums">{p.discovered ? `${p.rate}% of ${p.discovered}` : "—"}</span>
                </div>
              ))
            ) : (
              <Empty>Fills in once records with a pitch angle reach Discovery done.</Empty>
            )}
          </Card>
        )}
        <Card title="What we know" aside={`of ${o.total.toLocaleString("en-IN")}`}>
          {o.coverage.filter((c) => !UNSCORED_KINDS.has(kind) || c.label === "Phone" || c.label === "Email" || (c.label === "Lenders" && WRITABLE[kind].has("lenders_empanelled_with"))).map((c) => (
            <div key={c.label} className="grid grid-cols-[120px_1fr_40px] items-center gap-2 text-xs">
              <span>{c.label}</span>
              <Bar value={c.pct} max={100} />
              <span className="text-right font-mono tabular-nums">{c.pct}%</span>
            </div>
          ))}
          {!UNSCORED_KINDS.has(kind) && (
            <Button size="xs" variant="ghost" className="self-start" onClick={() => onGotoList("gaps")}>
              See rows missing facts →
            </Button>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr_0.8fr]">
        <Card title="The team" aside={periodWord}>
          {o.team.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] text-muted-foreground">
                    <th className="py-1 pr-2 font-medium">Person</th>
                    <th className="px-1 text-right font-medium">Assigned</th>
                    <th className="px-1 text-right font-medium">Touches</th>
                    <th className="px-1 text-right font-medium">Calls</th>
                    <th className="px-1 text-right font-medium">Reply %</th>
                    <th className="px-1 text-right font-medium">Overdue</th>
                    <th className="px-1 text-right font-medium">Demo done</th>
                    <th className="pl-1 text-right font-medium">Pilots</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {o.team.map((t) => (
                    <tr key={t.person} className="border-t">
                      <td className="py-1.5 pr-2 font-sans font-medium">{t.person}</td>
                      <td className="px-1 text-right">{t.assigned}</td>
                      <td className="px-1 text-right">{t.touches}</td>
                      <td className="px-1 text-right">{t.calls}</td>
                      <td className="px-1 text-right">{t.touches ? `${t.engagedRate}%` : "—"}</td>
                      <td className={t.overdue ? "px-1 text-right font-semibold text-red-700 dark:text-red-400" : "px-1 text-right text-muted-foreground"}>{t.overdue ? `! ${t.overdue}` : 0}</td>
                      <td className="px-1 text-right">{t.demos}</td>
                      <td className="pl-1 text-right">{t.pilots}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No one is assigned anything yet. Assign rows from a record or the List tab.</Empty>
          )}
        </Card>
        <Card title="Top objections" aside={<button type="button" className="font-medium text-brand hover:underline" onClick={() => onGotoPlaybook("objections")}>How to answer →</button>}>
          {o.objections.length ? (
            o.objections.slice(0, 6).map((x) => (
              <div key={x.objection} className="grid grid-cols-[170px_1fr_24px] items-center gap-2 text-xs">
                <span>{x.objection}</span>
                <Bar value={x.count} max={o.objections[0].count} />
                <span className="text-right font-mono tabular-nums">{x.count}</span>
              </div>
            ))
          ) : (
            <Empty>Objections recorded on calls show up here.</Empty>
          )}
        </Card>
        <Card title="Research agents">
          {o.research.map((r) => (
            <div key={r.label} className="flex items-center justify-between text-xs">
              <span>{r.label}</span>
              <span className="font-mono tabular-nums">{r.count.toLocaleString("en-IN")}</span>
            </div>
          ))}
          <Button size="xs" variant="outline" className="self-start" onClick={() => onGotoList("review")}>
            Review scored →
          </Button>
        </Card>
      </div>

      <Card title="A-band, nobody assigned" aside="the research agents finished these — pick them up">
        {o.unassignedA.length ? (
          <div className="flex flex-col">
            {o.unassignedA.map((r) => (
              <div key={r.id} className="grid grid-cols-[1fr_120px_64px_1fr_110px] items-center gap-3 border-t py-2 text-[13px] first:border-t-0">
                <button type="button" className="truncate text-left font-medium hover:underline" onClick={() => onOpen(r)}>
                  {r.name}
                </button>
                <span className="truncate text-muted-foreground">{r.city || r.state}</span>
                <BandBadge band={r.band} score={r.score} />
                <span className="truncate text-muted-foreground">{r.pitchAngle || "No pitch picked"}</span>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await assignToMe(r.kind, [r.id]);
                      if (res.ok) toast.success(res.message);
                      else toast.error(res.message);
                    })
                  }
                >
                  Assign to me
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <Empty>None right now. A-band rows appear here once the research agents score them.</Empty>
        )}
      </Card>
    </div>
  );
}
