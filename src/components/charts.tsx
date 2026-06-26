"use client";

import type { ReactNode } from "react";

export type Slice = { label: string; value: number; color: string };

/** Section wrapper so chart bands look consistent across views. */
export function ChartCard({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={"rounded-xl border bg-background p-4 " + (className ?? "")}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function Legend({ data, className }: { data: Slice[]; className?: string }) {
  return (
    <div className={"flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground " + (className ?? "")}>
      {data.map((d) => (
        <span key={d.label} className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ backgroundColor: d.color }} />
          {d.label}
          <span className="font-medium text-foreground">{d.value}</span>
        </span>
      ))}
    </div>
  );
}

/** SVG donut. Pass `center` to overlay a stat in the hole. */
export function Donut({
  data,
  size = 132,
  thickness = 16,
  center,
}: {
  data: Slice[];
  size?: number;
  thickness?: number;
  center?: ReactNode;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={thickness}
          className="stroke-foreground/[0.07]"
        />
        {total > 0 &&
          data
            .filter((d) => d.value > 0)
            .map((d, i) => {
              const dash = (d.value / total) * circ;
              const el = (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={d.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${dash} ${circ - dash}`}
                  strokeDashoffset={-offset}
                >
                  <title>{`${d.label}: ${d.value}`}</title>
                </circle>
              );
              offset += dash;
              return el;
            })}
      </svg>
      {center && (
        <div className="absolute inset-0 grid place-items-center text-center leading-tight">
          {center}
        </div>
      )}
    </div>
  );
}

/** Vertical column chart (counts or money per category). */
export function ColumnChart({
  data,
  height = 132,
  format,
}: {
  data: Slice[];
  height?: number;
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d) => (
        <div key={d.label} className="flex h-full min-w-0 flex-1 flex-col items-center gap-1">
          <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
            {format ? format(d.value) : d.value}
          </span>
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-[5px]"
              style={{
                height: `${(d.value / max) * 100}%`,
                minHeight: d.value > 0 ? 4 : 0,
                backgroundColor: d.color,
              }}
              title={`${d.label}: ${d.value}`}
            />
          </div>
          <span className="w-full truncate text-center text-[10px] text-muted-foreground" title={d.label}>
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Area + line trend chart for a time series. Stretches to fill width. */
export function AreaChart({
  data,
  color = "#6366f1",
  height = 120,
  format,
}: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
  format?: (n: number) => string;
}) {
  const W = 100;
  const n = data.length;
  const max = Math.max(1, ...data.map((d) => d.value));
  const x = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => height - (v / max) * (height - 8) - 4;
  const pts = data.map((d, i) => [x(i), y(d.value)] as const);
  const line = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(2)},${py.toFixed(2)}`).join(" ");
  const area =
    n > 0
      ? `${line} L${pts[n - 1][0].toFixed(2)},${height} L${pts[0][0].toFixed(2)},${height} Z`
      : "";
  const gid = `area-${color.replace("#", "")}`;
  const peak = data.reduce((m, d) => (d.value > m.value ? d : m), data[0] ?? { label: "", value: 0 });

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {area && <path d={area} fill={`url(#${gid})`} />}
        {n > 1 && (
          <path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
        )}
        {pts.map(([px, py], i) => (
          <circle key={i} cx={px} cy={py} r={1.6} fill={color} vectorEffect="non-scaling-stroke">
            <title>{`${data[i].label}: ${format ? format(data[i].value) : data[i].value}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{data[0]?.label}</span>
        {peak && peak.value > 0 && (
          <span>
            peak {peak.label} · {format ? format(peak.value) : peak.value}
          </span>
        )}
        <span>{data[n - 1]?.label}</span>
      </div>
    </div>
  );
}
