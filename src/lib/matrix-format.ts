/** Small formatting helpers shared by the CRM / Sales / Marketing views. */

export function formatMoney(n: number | null | undefined): string {
  const v = n ?? 0;
  return `$${v.toLocaleString("en-US")}`;
}

/**
 * Formatted in UTC, deliberately.
 *
 * Everything this renders is a CALENDAR DATE — a due date, a start date, a
 * cycle boundary — stored as a timestamp at UTC midnight. `toLocaleDateString`
 * reads the machine's timezone, so west of UTC "2026-08-15T00:00:00Z" renders
 * as **Aug 14**: every date a day early, everywhere in the Americas, while
 * looking perfectly correct in India and in CI (which both run at or east of
 * UTC). That is why `matrix-format.test.ts` was red on a developer machine and
 * green on every pipeline.
 *
 * `dateInputValue` below already reads these as UTC (`toISOString().slice(0,10)`),
 * so this is the two halves agreeing rather than a new convention — and a date
 * that disagrees with the `<input type="date">` next to it is the version of
 * this bug a user actually reports.
 */
export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** value of an <input type="date"> for a Date/string, or "" when empty. */
export function dateInputValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}
