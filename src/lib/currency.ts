/**
 * Multi-currency display for the Finance surfaces. Amounts are stored as raw
 * numbers in each row's *entity* currency (India → INR, Netherlands → EUR,
 * Global → USD); the Finance view lets you pick a display currency and converts
 * every row into it for the totals and charts.
 *
 * Rates are STATIC (this is an internal founder tool, not a trading desk) — bump
 * `inrPerUnit` and `RATES_AS_OF` when they drift. Everything is expressed
 * against INR as the base.
 */

export const CURRENCIES = [
  { id: "INR", symbol: "₹", locale: "en-IN", inrPerUnit: 1 },
  { id: "USD", symbol: "$", locale: "en-US", inrPerUnit: 83 },
  { id: "EUR", symbol: "€", locale: "en-IE", inrPerUnit: 90 },
] as const;

export type CurrencyId = (typeof CURRENCIES)[number]["id"];

/** Human note for the UI — when the static rates above were last set. */
export const RATES_AS_OF = "Jun 2026";

const BY_ID: Record<string, (typeof CURRENCIES)[number]> = Object.fromEntries(
  CURRENCIES.map((c) => [c.id, c]),
);

/** Which currency an entity's amounts are stored in. Defaults to INR. */
export const ENTITY_CURRENCY: Record<string, CurrencyId> = {
  India: "INR",
  Netherlands: "EUR",
  Global: "USD",
};

export function entityCurrency(entity: string | null | undefined): CurrencyId {
  return ENTITY_CURRENCY[entity ?? ""] ?? "INR";
}

export function currencySymbol(id: string): string {
  return BY_ID[id]?.symbol ?? id;
}

/** Convert an amount between currencies via the INR base. */
export function convert(amount: number, from: string, to: string): number {
  if (from === to) return amount;
  const f = BY_ID[from]?.inrPerUnit ?? 1;
  const t = BY_ID[to]?.inrPerUnit ?? 1;
  return (amount * f) / t;
}

/** Symbol + grouped, rounded number in the given currency (e.g. "₹2,780"). */
export function formatCurrency(amount: number, id: string): string {
  const c = BY_ID[id];
  return `${c?.symbol ?? ""}${Math.round(amount).toLocaleString(c?.locale ?? "en-IN")}`;
}
