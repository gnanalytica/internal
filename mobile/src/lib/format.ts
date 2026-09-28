import { differenceInCalendarDays, format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";

const toDate = (v: string | Date | null | undefined): Date | null => {
  if (!v) return null;
  const d = typeof v === "string" ? parseISO(v) : v;
  return isValid(d) ? d : null;
};

/** "3m", "2h", "5d" — compact, like the web's timestamps. */
export function ago(v: string | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return "";
  const s = formatDistanceToNowStrict(d, { roundingMethod: "floor" });
  return s.replace(/ seconds?/, "s").replace(/ minutes?/, "m").replace(/ hours?/, "h").replace(/ days?/, "d").replace(/ months?/, "mo").replace(/ years?/, "y");
}

/** "28 Sep" this year, "28 Sep 2025" otherwise. */
export function shortDate(v: string | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return "";
  return format(d, d.getFullYear() === new Date().getFullYear() ? "d MMM" : "d MMM yyyy");
}

export function longDate(v: string | Date | null | undefined): string {
  const d = toDate(v);
  return d ? format(d, "d MMM yyyy, h:mm a") : "";
}

/** "Today", "Tomorrow", "In 3 days", "2 days late". */
export function dueLabel(v: string | Date | null | undefined): { text: string; late: boolean } | null {
  const d = toDate(v);
  if (!d) return null;
  const days = differenceInCalendarDays(d, new Date());
  if (days === 0) return { text: "Today", late: false };
  if (days === 1) return { text: "Tomorrow", late: false };
  if (days > 1) return { text: days <= 7 ? `In ${days} days` : shortDate(d), late: false };
  return { text: `${-days} day${days === -1 ? "" : "s"} late`, late: true };
}

/** yyyy-mm-dd for the API. */
export const isoDay = (d: Date): string => format(d, "yyyy-MM-dd");

/** Indian grouping: ₹12,50,000. */
export function inr(amount: number | null | undefined, currency = "INR"): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "—";
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString("en-IN")}`;
  }
}

export const initials = (name: string | null | undefined): string =>
  (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
