"use client";

import "./strategy.css";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { kpiState, type KpiState, type StageKpi } from "@/lib/strategy";

/** Numbered section header: badge + uppercase title + plain-gloss subtitle. */
export function Section({
  n,
  title,
  sub,
  children,
  className,
}: {
  n: number;
  title: string;
  sub: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`s-rise rounded-xl border bg-card p-4 ${className ?? ""}`}>
      <div className="mb-3 flex items-center gap-2.5 border-b pb-2.5">
        <span className="grid size-6 flex-none place-items-center rounded-md bg-gradient-to-br from-teal-500 to-sky-500 text-xs font-extrabold text-white">
          {n}
        </span>
        <div className="flex flex-col">
          <h2 className="text-[13px] font-bold uppercase tracking-wider">{title}</h2>
          <span className="text-[10.5px] text-muted-foreground">{sub}</span>
        </div>
      </div>
      {children}
    </section>
  );
}

/** Cursor-following tooltip for every element carrying a data-tip. Mount once. */
export function TipLayer() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tip = ref.current;
    if (!tip) return;
    let on = false;
    const over = (e: MouseEvent) => {
      const t = (e.target as HTMLElement).closest("[data-tip]") as HTMLElement | null;
      if (t?.dataset.tip) {
        tip.textContent = t.dataset.tip;
        on = true;
        tip.classList.add("s-tip-on");
      } else if (on) {
        on = false;
        tip.classList.remove("s-tip-on");
      }
    };
    const move = (e: MouseEvent) => {
      if (on) {
        tip.style.left = `${e.clientX}px`;
        tip.style.top = `${e.clientY}px`;
      }
    };
    document.addEventListener("mouseover", over);
    document.addEventListener("mousemove", move);
    return () => {
      document.removeEventListener("mouseover", over);
      document.removeEventListener("mousemove", move);
    };
  }, []);
  return <div ref={ref} className="s-tip" />;
}

const RING_R = 23;
const RING_C = 2 * Math.PI * RING_R;

/** Score ring: ≥75 green, ≥50 amber, else red; null = grey/em-dash. */
export function Ring({ pct, size = 46, label }: { pct: number | null; size?: number; label?: string }) {
  const stroke =
    pct == null ? "#64748b" : pct >= 75 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
  const off = pct == null ? RING_C : RING_C * (1 - pct / 100);
  return (
    <svg width={size} height={size} viewBox="0 0 58 58" aria-label={label}>
      <circle cx="29" cy="29" r={RING_R} fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
      <circle
        className="s-ring-arc"
        cx="29"
        cy="29"
        r={RING_R}
        fill="none"
        stroke={stroke}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={RING_C}
        strokeDashoffset={off}
        transform="rotate(-90 29 29)"
      />
      <text x="29" y="34" textAnchor="middle" fontSize="15" fontWeight="700" fill="currentColor">
        {pct ?? "—"}
      </text>
    </svg>
  );
}

/** Animated horizontal progress bar (pct 0–100). */
export function HBar({ pct, className }: { pct: number; className?: string }) {
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-muted ${className ?? ""}`}>
      <div
        className="s-grow h-full rounded-full bg-gradient-to-r from-teal-500 to-sky-500"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

const KPI_TEXT: Record<KpiState, string> = {
  ok: "text-emerald-500",
  warn: "text-amber-500",
  bad: "text-red-500",
  na: "text-muted-foreground",
};

/** KPI chip: name + current(/target), value colored by kpiState. */
export function KpiChipView({ kpi }: { kpi: StageKpi }) {
  const state = kpiState(kpi);
  return (
    <span className="s-chip inline-flex items-baseline gap-1 text-muted-foreground" data-tip={kpi.tip}>
      {kpi.name}
      <b className={`font-bold ${KPI_TEXT[state]}`}>
        {kpi.current ?? "—"}
        {typeof kpi.target === "number" ? `/${kpi.target}` : ""}
      </b>
      {kpi.autoKey ? (
        <span className="rounded bg-sky-500 px-1 text-[9px] font-bold text-white" data-tip="auto-derived from hub data — can't be hand-set">
          auto
        </span>
      ) : null}
    </span>
  );
}

/** Edit-in-place text: dashed-underline span, saves on blur when changed. */
export function Editable({
  value,
  placeholder,
  onSave,
  className,
}: {
  value?: string;
  placeholder: string;
  onSave: (next: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el) {
      el.textContent = value || placeholder;
    }
  }, [value, placeholder]);
  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-tip="editable — click and type"
      className={`s-set ${value ? "" : "text-muted-foreground"} ${className ?? ""}`}
      onBlur={(e) => {
        const next = e.currentTarget.textContent?.trim() ?? "";
        if (next !== (value ?? "") && next !== placeholder) onSave(next);
      }}
    >
      {value || placeholder}
    </span>
  );
}

/** Tiny expandable add-form: a "＋" chip that opens inline inputs. */
export function InlineAdd({
  fields,
  onAdd,
  label = "add",
}: {
  fields: { key: string; placeholder: string; type?: "text" | "number" }[];
  onAdd: (values: Record<string, string>) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  if (!open) {
    return (
      <button type="button" className="s-chip text-muted-foreground" onClick={() => setOpen(true)}>
        ＋ {label}
      </button>
    );
  }
  return (
    <form
      className="flex flex-wrap items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        onAdd(vals);
        setVals({});
        setOpen(false);
      }}
    >
      {fields.map((f) => (
        <input
          key={f.key}
          type={f.type ?? "text"}
          placeholder={f.placeholder}
          value={vals[f.key] ?? ""}
          onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
          className="h-7 w-28 rounded-md border bg-transparent px-2 text-xs"
        />
      ))}
      <button type="submit" className="s-chip">
        save
      </button>
      <button type="button" className="s-chip" onClick={() => setOpen(false)}>
        ×
      </button>
    </form>
  );
}
