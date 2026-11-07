"use client";

import { Empty } from "@/components/prospects-dashboard/bits";
import { addDays, CHANNELS, dayLabel, rowOf, weeklyPosted, weekStart } from "@/lib/marketing";
import { tone, type Tone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { ChannelDot, type Piece } from "./bits";

const WEEKS = 8;

/** How often each channel actually posts: the last eight weeks, then totals. */
export function ChannelsTab({ items, today }: { items: Piece[]; today: string }) {
  const last = weekStart(today);
  const starts = Array.from({ length: WEEKS }, (_, i) => addDays(last, (i - WEEKS + 1) * 7));
  const weekly = weeklyPosted(items, last, WEEKS);
  const rows = [...CHANNELS.map((c) => ({ id: c.id as string, label: c.label as string, tone: c.tone as Tone })), { id: "other", label: "No channel", tone: "gray" as Tone }]
    .map((c) => {
      const mine = items.filter((p) => rowOf(p) === c.id);
      const posted = mine.filter((p) => p.status === "published");
      return {
        ...c,
        weeks: weekly.get(c.id) ?? Array<number>(WEEKS).fill(0),
        pieces: mine.length,
        posted: posted.length,
        views: posted.reduce((s, p) => s + (p.views ?? 0), 0),
        clicks: posted.reduce((s, p) => s + (p.clicks ?? 0), 0),
      };
    })
    .filter((r) => r.id !== "other" || r.pieces > 0);
  const max = Math.max(1, ...rows.flatMap((r) => r.weeks));
  const anyPosted = rows.some((r) => r.posted > 0);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-muted-foreground">Pieces marked Posted, by the week they went out. Views and clicks are what was typed in on each piece.</p>
      {!anyPosted && <Empty>Nothing is marked Posted yet. Once a piece goes out, set it to Posted and it counts here.</Empty>}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead className="bg-muted/40 text-left text-[11px] text-muted-foreground">
            <tr className="border-b">
              <th scope="col" className="w-40 py-2 pl-3 font-normal">
                Channel
              </th>
              {starts.map((s) => (
                <th key={s} scope="col" className={cn("px-1 text-center font-mono font-normal", s === last && "text-foreground")}>
                  {s === last ? "This wk" : dayLabel(s).split(" ").slice(1).join(" ")}
                </th>
              ))}
              <th scope="col" className="px-3 text-right font-normal">
                8 wks
              </th>
              <th scope="col" className="px-3 text-right font-normal">
                Posted / all
              </th>
              <th scope="col" className="px-3 text-right font-normal">
                Views
              </th>
              <th scope="col" className="px-3 text-right font-normal">
                Clicks
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="h-12 border-b border-border/60 last:border-b-0">
                <th scope="row" className="pl-3 text-left font-medium">
                  <span className="inline-flex items-center gap-2">
                    <ChannelDot channel={r.id === "other" ? null : r.id} /> {r.label}
                  </span>
                </th>
                {r.weeks.map((n, i) => (
                  <td key={starts[i]} className="px-1">
                    <div className="mx-auto flex h-8 w-6 flex-col justify-end" title={`${n} posted, week of ${dayLabel(starts[i])}`}>
                      <div className={cn("rounded-sm transition-[height] duration-500", n ? tone(r.tone).bar : "bg-muted")} style={{ height: n ? `${Math.max(18, Math.round((n / max) * 100))}%` : "2px" }} />
                    </div>
                    <div className={cn("text-center font-mono text-[11px] tabular-nums", n ? "text-foreground" : "text-muted-foreground/60")}>{n}</div>
                  </td>
                ))}
                <td className="px-3 text-right font-mono tabular-nums">{r.weeks.reduce((s, n) => s + n, 0)}</td>
                <td className="px-3 text-right font-mono text-muted-foreground tabular-nums">
                  {r.posted}
                  <span className="text-muted-foreground/60"> / {r.pieces}</span>
                </td>
                <td className="px-3 text-right font-mono tabular-nums">{r.views ? r.views.toLocaleString("en-IN") : "—"}</td>
                <td className="px-3 text-right font-mono tabular-nums">{r.clicks ? r.clicks.toLocaleString("en-IN") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
