"use client";

import { useState, useTransition } from "react";

import { updateProjectEconomics } from "@/lib/actions";

type Economics = {
  currency?: string;
  unitLabel?: string;
  pricePerUnit?: number;
  costPerUnit?: number;
  unitsPerMonth?: number;
  notes?: string;
};

const CURRENCIES = [
  { id: "INR", symbol: "₹" },
  { id: "USD", symbol: "$" },
  { id: "EUR", symbol: "€" },
] as const;

const fieldCls =
  "h-8 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40";

/**
 * The Economics department's unit-economics model for one product: pricing and
 * per-unit cost in, margin out. Founder-only (the route already gates it). The
 * scoped invoices/expenses ledger renders below this, from FinanceView.
 */
export function EconomicsCard({
  projectId,
  economics,
}: {
  projectId: string;
  economics: Economics | null;
}) {
  const [state, setState] = useState<Economics>(economics ?? { currency: "INR" });
  const [, start] = useTransition();

  const symbol = CURRENCIES.find((c) => c.id === (state.currency ?? "INR"))?.symbol ?? "₹";
  const money = (n: number) => `${symbol}${Math.round(n).toLocaleString("en-IN")}`;

  const price = state.pricePerUnit ?? 0;
  const cost = state.costPerUnit ?? 0;
  const units = state.unitsPerMonth ?? 0;
  const marginPerUnit = price - cost;
  const marginPct = price > 0 ? (marginPerUnit / price) * 100 : 0;
  const monthlyRevenue = price * units;
  const monthlyProfit = marginPerUnit * units;

  const persist = (patch: Parameters<typeof updateProjectEconomics>[1]) =>
    start(async () => {
      await updateProjectEconomics(projectId, patch);
    });

  const numField = (
    label: string,
    value: number | undefined,
    onLocal: (v: number | undefined) => void,
    commit: (v: number | null) => void,
    prefix?: string,
  ) => (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1">
        {prefix && <span className="text-sm text-muted-foreground">{prefix}</span>}
        <input
          type="number"
          min={0}
          defaultValue={value ?? ""}
          placeholder="—"
          onChange={(e) => onLocal(e.target.value === "" ? undefined : Number(e.target.value))}
          onBlur={(e) => commit(e.target.value === "" ? null : Number(e.target.value))}
          className={fieldCls + " w-28 tabular-nums"}
        />
      </span>
    </label>
  );

  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Unit economics
        </h3>
        <span className="text-[11px] text-muted-foreground">
          Company books live in Finance · this is {state.unitLabel ? `per ${state.unitLabel}` : "per unit"}
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">A unit is…</span>
          <input
            defaultValue={state.unitLabel ?? ""}
            placeholder="report"
            onChange={(e) => setState((s) => ({ ...s, unitLabel: e.target.value || undefined }))}
            onBlur={(e) => persist({ unitLabel: e.target.value || null })}
            className={fieldCls + " w-28"}
          />
        </label>
        {numField(
          "Price / unit",
          state.pricePerUnit,
          (v) => setState((s) => ({ ...s, pricePerUnit: v })),
          (v) => persist({ pricePerUnit: v }),
          symbol,
        )}
        {numField(
          "Cost / unit",
          state.costPerUnit,
          (v) => setState((s) => ({ ...s, costPerUnit: v })),
          (v) => persist({ costPerUnit: v }),
          symbol,
        )}
        {numField(
          "Units / month",
          state.unitsPerMonth,
          (v) => setState((s) => ({ ...s, unitsPerMonth: v })),
          (v) => persist({ unitsPerMonth: v }),
        )}
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">Currency</span>
          <select
            defaultValue={state.currency ?? "INR"}
            onChange={(e) => {
              setState((s) => ({ ...s, currency: e.target.value }));
              persist({ currency: e.target.value });
            }}
            className={fieldCls}
          >
            {CURRENCIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Gross margin / unit" value={money(marginPerUnit)} sub={`${marginPct.toFixed(0)}% margin`} good={marginPerUnit > 0} />
        <Metric label="Monthly revenue" value={money(monthlyRevenue)} sub={units ? `${units.toLocaleString("en-IN")} units` : "set units/mo"} />
        <Metric label="Monthly gross profit" value={money(monthlyProfit)} sub="before opex" good={monthlyProfit > 0} />
        <Metric label="Annualised gross profit" value={money(monthlyProfit * 12)} sub="run-rate" good={monthlyProfit > 0} />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  good,
}: {
  label: string;
  value: string;
  sub: string;
  good?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={
          "mt-0.5 text-lg font-semibold tabular-nums " +
          (good === undefined ? "" : good ? "text-emerald-600" : "text-rose-600")
        }
      >
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}
