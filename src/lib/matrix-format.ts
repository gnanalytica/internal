/** Small formatting helpers shared by the CRM / Sales / Marketing views. */

export function formatMoney(n: number | null | undefined): string {
  const v = n ?? 0;
  return `$${v.toLocaleString("en-US")}`;
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** value of an <input type="date"> for a Date/string, or "" when empty. */
export function dateInputValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}
