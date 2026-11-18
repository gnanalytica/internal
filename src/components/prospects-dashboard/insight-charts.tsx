"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * The Insights charts' marks, in plain HTML so Tailwind colours and both
 * themes come for free. Each follows the house chart rules: bars at most 24px
 * thick with a 4px rounded end, 2px surface gaps between touching segments,
 * hairline recessive grid, a legend whenever there are two or more series,
 * a readout on hover and on keyboard focus, and a screen-reader table so no
 * value lives only in colour or only in the tooltip.
 */

export type Series = { key: string; label: string; swatch: string };

export function Legend({ items, className }: { items: Series[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground", className)}>
      {items.map((s) => (
        <li key={s.key} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cn("size-2.5 rounded-[3px]", s.swatch)} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

function Readout({ title, lines }: { title: string; lines: { label: string; value: string; swatch?: string }[] }) {
  return (
    <div role="status" className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 min-w-36 -translate-x-1/2 rounded-md border bg-popover px-2.5 py-2 text-xs whitespace-nowrap text-popover-foreground shadow-md">
      <p className="mb-1 text-muted-foreground">{title}</p>
      {lines.map((l) => (
        <p key={l.label} className="flex items-center gap-2">
          {l.swatch && <span aria-hidden className={cn("h-0.5 w-3 rounded-full", l.swatch)} />}
          <span className="font-medium tabular-nums">{l.value}</span>
          <span className="text-muted-foreground">{l.label}</span>
        </p>
      ))}
    </div>
  );
}

/** Round a max up to a clean axis top: 1, 2, 5 × 10ⁿ. */
function niceMax(v: number): number {
  if (v <= 4) return Math.max(1, Math.ceil(v));
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v)!;
}

/**
 * Columns, stacked by series, over an ordered axis (days or weeks). One axis,
 * zero-based; the hovered or focused column lists every series.
 */
export function StackedColumns({
  columns,
  series,
  height = 160,
  label,
}: {
  columns: { key: string; label: string; title: string; values: Record<string, number>; total: number }[];
  series: Series[];
  height?: number;
  label: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const top = niceMax(Math.max(0, ...columns.map((c) => c.total)));
  // At most ~6 date labels, so each has room; the last column is always labelled.
  const every = Math.ceil(columns.length / 6);
  return (
    <figure className="flex flex-col gap-3">
      {series.length > 1 && <Legend items={series} />}
      <div className="grid grid-cols-[28px_1fr] gap-x-2">
        <div className="relative text-right font-mono text-[10px] text-muted-foreground tabular-nums" style={{ height }}>
          <span className="absolute top-0 right-0 -translate-y-1/2">{top}</span>
          <span className="absolute right-0 bottom-0 translate-y-1/2">0</span>
        </div>
        <div className="relative" style={{ height }} onPointerLeave={() => setActive(null)}>
          <div aria-hidden className="absolute inset-x-0 top-0 border-t border-border/60" />
          <div aria-hidden className="absolute inset-x-0 top-1/2 border-t border-border/60" />
          <div aria-hidden className="absolute inset-x-0 bottom-0 border-t border-border" />
          <div className="absolute inset-0 flex items-end">
            {columns.map((c, i) => (
              <div
                key={c.key}
                tabIndex={0}
                aria-label={`${c.title}: ${c.total}`}
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="group relative flex h-full flex-1 items-end justify-center outline-none"
              >
                <div className={cn("flex w-full max-w-6 flex-col-reverse gap-[2px] transition-opacity", active !== null && active !== i && "opacity-50")} style={{ height: `${(c.total / top) * 100}%` }}>
                  {series.map((s) => {
                    const v = c.values[s.key] ?? 0;
                    if (!v) return null;
                    return <div key={s.key} className={cn("w-full first:rounded-b-none last:rounded-t-[4px]", s.swatch)} style={{ flexGrow: v, flexBasis: 0 }} />;
                  })}
                  {/* Touches on channels not drawn ("Other") keep the column true to its total. */}
                  {c.total > series.reduce((s, x) => s + (c.values[x.key] ?? 0), 0) && <div className="w-full rounded-t-[4px] bg-zinc-400 dark:bg-zinc-500" style={{ flexGrow: c.total - series.reduce((s, x) => s + (c.values[x.key] ?? 0), 0), flexBasis: 0 }} />}
                </div>
                {active === i && (
                  <Readout
                    title={c.title}
                    lines={[{ label: "touches", value: String(c.total) }, ...series.map((s) => ({ label: s.label, value: String(c.values[s.key] ?? 0), swatch: s.swatch }))]}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
        <span />
        <div className="flex">
          {columns.map((c, i) => (
            // Labels may spill over their neighbours' empty slots, never get cut: only every nth column has one.
            <span key={c.key} className="relative h-4 flex-1 text-[10px] text-muted-foreground">
              {(i % every === 0 || i === columns.length - 1) && (i === columns.length - 1 || columns.length - 1 - i >= every) && <span className={cn("absolute whitespace-nowrap", i === columns.length - 1 ? "right-0" : i === 0 ? "left-0" : "left-1/2 -translate-x-1/2")}>{c.label}</span>}
            </span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th>When</th>
            {series.map((s) => (
              <th key={s.key}>{s.label}</th>
            ))}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((c) => (
            <tr key={c.key}>
              <th>{c.title}</th>
              {series.map((s) => (
                <td key={s.key}>{c.values[s.key] ?? 0}</td>
              ))}
              <td>{c.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/**
 * One whole split into parts: a 28px bar, each part its own block with its
 * count printed when it fits, names in the legend below. Hover or focus a
 * block for its name, count and share.
 */
export function SegmentedBar({ parts, label }: { parts: { key: string; label: string; value: number; swatch: string; ink: string }[]; label: string }) {
  const [active, setActive] = useState<string | null>(null);
  const total = parts.reduce((s, p) => s + p.value, 0);
  const shown = parts.filter((p) => p.value > 0);
  return (
    <figure className="flex flex-col gap-3">
      <div role="list" aria-label={label} className="flex h-7 gap-[2px]" onPointerLeave={() => setActive(null)}>
        {shown.map((p) => {
          const share = Math.round((p.value / total) * 100);
          return (
            <div
              key={p.key}
              role="listitem"
              tabIndex={0}
              aria-label={`${p.label}: ${p.value} (${share}%)`}
              onPointerEnter={() => setActive(p.key)}
              onFocus={() => setActive(p.key)}
              onBlur={() => setActive(null)}
              className={cn("relative flex min-w-[3px] items-center rounded-[4px] px-2 text-xs font-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring", p.swatch, p.ink)}
              style={{ flexGrow: p.value, flexBasis: 0 }}
            >
              {/* The count only where it fits; the readout and legend carry it otherwise. */}
              <span className={cn("truncate", share < 7 && "sr-only")}>{p.value}</span>
              {active === p.key && <Readout title={p.label} lines={[{ label: `of ${total}`, value: `${p.value} · ${share}%` }]} />}
            </div>
          );
        })}
        {total === 0 && <div className="flex-1 rounded-[4px] bg-muted" />}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {parts.map((p) => (
          <li key={p.key} className="inline-flex items-center gap-1.5">
            <span aria-hidden className={cn("size-2.5 rounded-[3px]", p.swatch)} />
            {p.label}
            <span className="font-mono tabular-nums text-foreground/80">{p.value}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/**
 * Several wholes compared on one 0–100% axis: a row per category, each split
 * by the same series. Counts behind each share are in the readout and table.
 */
export function StackedRows({ rows, series, label }: { rows: { key: string; label: React.ReactNode; name: string; total: number; values: Record<string, number> }[]; series: Series[]; label: string }) {
  const [active, setActive] = useState<string | null>(null);
  return (
    <figure className="flex flex-col gap-3">
      <Legend items={series} />
      <div className="flex flex-col gap-2" onPointerLeave={() => setActive(null)}>
        {rows.map((r) => (
          <div key={r.key} className="grid grid-cols-[84px_1fr_32px] items-center gap-3 text-[13px]">
            <span className="truncate">{r.label}</span>
            <div
              tabIndex={0}
              aria-label={`${r.name}: ${series.map((s) => `${r.values[s.key] ?? 0} ${s.label}`).join(", ")}`}
              onPointerEnter={() => setActive(r.key)}
              onFocus={() => setActive(r.key)}
              onBlur={() => setActive(null)}
              className="relative flex h-3.5 gap-[2px] rounded-[4px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {series.map((s) => {
                const v = r.values[s.key] ?? 0;
                return v ? <div key={s.key} className={cn("h-full first:rounded-l-[4px] last:rounded-r-[4px]", s.swatch)} style={{ flexGrow: v, flexBasis: 0 }} /> : null;
              })}
              {active === r.key && (
                <Readout title={r.name} lines={series.map((s) => ({ label: s.label, value: `${r.values[s.key] ?? 0} · ${r.total ? Math.round(((r.values[s.key] ?? 0) / r.total) * 100) : 0}%`, swatch: s.swatch }))} />
              )}
            </div>
            <span className="text-right font-mono text-xs text-muted-foreground tabular-nums">{r.total}</span>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th>Channel</th>
            {series.map((s) => (
              <th key={s.key}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th>{r.name}</th>
              {series.map((s) => (
                <td key={s.key}>{r.values[s.key] ?? 0}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** One series of columns over ordered buckets, value on each cap (few buckets, so every one is labelled). */
export function Columns({ data, swatch, height = 120, label, unit }: { data: { label: string; value: number }[]; swatch: string; height?: number; label: string; unit: string }) {
  const top = niceMax(Math.max(0, ...data.map((d) => d.value)));
  return (
    <figure className="flex flex-col gap-1.5">
      <div className="relative flex items-end gap-2 border-b border-border" style={{ height }} aria-hidden>
        {data.map((d) => (
          <div key={d.label} title={`${d.label} ${unit}: ${d.value}`} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{d.value}</span>
            <div className={cn("w-full max-w-6 rounded-t-[4px]", swatch)} style={{ height: `${(d.value / top) * 85}%`, minHeight: d.value ? 3 : 0 }} />
          </div>
        ))}
      </div>
      <div className="flex gap-2" aria-hidden>
        {data.map((d) => (
          <span key={d.label} className="flex-1 text-center text-[10px] text-muted-foreground">
            {d.label}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th>
                {d.label} {unit}
              </th>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
