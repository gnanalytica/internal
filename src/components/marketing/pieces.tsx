"use client";

import { useMemo } from "react";

import { CONTENT_FORMATS, dayLabel, dayOf, FORMATS, formatOf, timeOf, type ContentFormat } from "@/lib/marketing";
import { cn } from "@/lib/utils";
import { ChannelDot, formatChannelLabel, StatusChip, type Piece } from "./bits";

const num = (n: number | null) => (n === null ? "—" : n.toLocaleString("en-IN"));

function goesOut(p: Piece): string {
  const d = dayOf(p.publishDate);
  return d ? `${dayLabel(d)} · ${timeOf(p.publishDate)}` : "No date";
}

/** Every piece in one table, filtered by format, each opening its editor. */
export function PiecesTab({
  items,
  format,
  setFormat,
  openId,
  onOpen,
}: {
  items: Piece[];
  format: ContentFormat | "";
  setFormat: (f: ContentFormat | "") => void;
  openId: string | null;
  onOpen: (p: Piece) => void;
}) {
  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const p of items) {
      const f = formatOf(p);
      if (f) c.set(f, (c.get(f) ?? 0) + 1);
    }
    return c;
  }, [items]);
  const shown = format ? items.filter((p) => formatOf(p) === format) : items;
  const emptyText = items.length === 0 ? "No pieces yet. Use New piece to add the first one — a title is enough to start." : `No ${FORMATS[format as ContentFormat]?.plural.toLowerCase()} yet. Use New piece while this filter is on to start one.`;

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Format" className="no-scrollbar -mx-3 flex gap-0.5 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        {[{ value: "" as const, label: "All", n: items.length }, ...CONTENT_FORMATS.map((f) => ({ value: f, label: FORMATS[f].plural, n: counts.get(f) ?? 0 }))].map((t) => (
          <button
            key={t.value || "all"}
            type="button"
            role="tab"
            aria-selected={t.value === format}
            onClick={() => setFormat(t.value)}
            className={cn("h-8 shrink-0 rounded-md px-2.5 text-[13px] whitespace-nowrap", t.value === format ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground", t.n === 0 && t.value !== format && "opacity-60")}
          >
            {t.label} <span className="font-mono text-[11px] text-muted-foreground/70">{t.n}</span>
          </button>
        ))}
      </div>

      <ul className="divide-y rounded-lg border md:hidden">
        {shown.map((p) => (
          <li key={p.id} className={cn(openId === p.id && "bg-muted/60")}>
            <button type="button" onClick={() => onOpen(p)} className="flex w-full flex-col gap-1 px-3 py-2.5 text-left">
              <span className="flex items-center gap-2">
                <ChannelDot channel={p.channel} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.title}</span>
              </span>
              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                <StatusChip status={p.status} />
                <span>{formatChannelLabel(p)}</span>
                <span className="font-mono">{goesOut(p)}</span>
              </span>
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">{emptyText}</li>}
      </ul>

      <div className="overflow-x-auto rounded-lg border max-md:hidden">
        <table className="w-full min-w-[720px] table-fixed text-[13px]">
          <thead className="bg-muted/40 text-left text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            <tr className="border-b">
              <th scope="col" className="w-[36%] py-2 pr-3 pl-3 font-normal">
                Piece
              </th>
              <th scope="col" className="px-3 font-normal">
                Format
              </th>
              <th scope="col" className="w-28 px-3 font-normal">
                Status
              </th>
              <th scope="col" className="w-36 px-3 font-normal">
                Goes out
              </th>
              <th scope="col" className="w-20 px-3 text-right font-normal">
                Views
              </th>
              <th scope="col" className="w-20 px-3 text-right font-normal">
                Clicks
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id} onClick={() => onOpen(p)} className={cn("h-11 cursor-pointer border-b border-border/60 last:border-b-0 even:bg-muted/15 hover:bg-brand/[0.04]", openId === p.id && "bg-brand/[0.07] even:bg-brand/[0.07]")}>
                <td className="truncate pr-3 pl-3">
                  <span className="inline-flex max-w-full items-center gap-2">
                    <ChannelDot channel={p.channel} />
                    <button type="button" onClick={() => onOpen(p)} className="truncate font-medium hover:underline">
                      {p.title}
                    </button>
                  </span>
                </td>
                <td className="truncate px-3 text-muted-foreground">{formatChannelLabel(p)}</td>
                <td className="px-3">
                  <StatusChip status={p.status} />
                </td>
                <td className={cn("truncate px-3 font-mono text-xs", !p.publishDate && "text-muted-foreground")}>{goesOut(p)}</td>
                <td className="px-3 text-right font-mono text-xs tabular-nums">{num(p.views)}</td>
                <td className="px-3 text-right font-mono text-xs tabular-nums">{num(p.clicks)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">{emptyText}</p>}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-lg bg-muted/50 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
        <span className="w-full text-[13px] font-semibold text-foreground">What each format asks for</span>
        {CONTENT_FORMATS.map((f) => (
          <span key={f} className="flex-[1_1_200px]">
            <span className="font-medium text-foreground">{FORMATS[f].label}</span> · {FORMATS[f].asks}
          </span>
        ))}
      </div>
    </div>
  );
}
