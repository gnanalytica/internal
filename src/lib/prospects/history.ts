import type { ActivityEntry } from "./parse";
import { displayDate } from "./parse";
import { CHANNELS, OUTCOMES } from "./schema";

/**
 * A record's history, Linear-style: one list, newest first, built from what
 * the sheet already holds — the Activity rows (touches) and the dated lines
 * at the top of `notes`. Owner and stage changes are written there as lines
 * in the formats below; the parser reads the same formats back, so the two
 * can't drift. Lines people typed or edited by hand stay as plain notes.
 */

const first = (name: string) => name.trim().split(/\s+/)[0] ?? "";

/** "Assigned to Parv (was Tasleem) by Sandeep" / "Unassigned (was Parv) by Sandeep", without the date. */
export function ownerLineText(to: string, from: string, by: string): string {
  const b = first(by);
  return `${to ? `Assigned to ${to}` : "Unassigned"}${from ? ` (was ${from})` : ""}${b ? ` by ${b}` : ""}`;
}

/** "Stage: Contacted → Discovery done by Sandeep", without the date. */
export function stageLineText(from: string, to: string, by: string): string {
  const b = first(by);
  return `Stage: ${from || "—"} → ${to}${b ? ` by ${b}` : ""}`;
}

/** A comment as a notes line: one line, signed — "27-11-2026 — @parv call him Thursday — Sandeep". */
export function commentLine(today: string, text: string, by: string): string {
  const body = text.replace(/\s*\n+\s*/g, " ").trim();
  const b = first(by);
  return datedLine(today, b ? `${body} — ${b}` : body);
}

/** A dated notes line: "27-11-2026 — <text>". */
export const datedLine = (today: string, text: string) => `${displayDate(today)} — ${text}`;

export type HistoryItem =
  | { type: "touch"; date: string | null; entry: ActivityEntry }
  | { type: "owner"; date: string | null; to: string; from: string; by: string }
  | { type: "stage"; date: string | null; from: string; to: string; by: string }
  /** A note or comment; `by` is its signature ("… — Sandeep"), when it has one. */
  | { type: "note"; date: string | null; text: string; by?: string };

const OWNER = /^(?:Assigned to (.+?)|Unassigned)(?: \(was (.+?)\))?(?: by (\S+))?$/;
const STAGE = /^Stage: (.+?) → (.+?)(?: by (\S+))?$/;
const TOUCH = new RegExp(`^(${CHANNELS.join("|")})(?: \\(\\d+ min\\))?: (${[...OUTCOMES].sort((a, b) => b.length - a.length).map((o) => o.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`);

/** dd-mm-yyyy → yyyy-mm-dd. */
const isoOf = (d: string) => `${d.slice(6, 10)}-${d.slice(3, 5)}-${d.slice(0, 2)}`;

/**
 * The timeline for one record. `notes` is newest first; `activity` should be
 * too (as the record read returns it). A touch's own note line is replaced by
 * its Activity row, so a touch shows once; a touch whose line was edited away
 * still shows, placed by date. Nothing is ever dropped.
 */
export function buildHistory(notes: string, activity: ActivityEntry[]): HistoryItem[] {
  const unused = [...activity];
  const items: HistoryItem[] = [];
  for (const raw of notes.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^(\d{2}-\d{2}-\d{4})\s+—\s+(.*)$/.exec(line);
    const date = m ? isoOf(m[1]) : null;
    const text = m ? m[2].trim() : line;
    const touch = m ? TOUCH.exec(text) : null;
    if (touch) {
      const i = unused.findIndex((a) => a.date === date && a.channel === touch[1] && a.outcome === touch[2]);
      if (i >= 0) {
        items.push({ type: "touch", date, entry: unused.splice(i, 1)[0] });
        continue;
      }
    }
    const owner = m ? OWNER.exec(text) : null;
    if (owner) {
      items.push({ type: "owner", date, to: owner[1] ?? "", from: owner[2] ?? "", by: owner[3] ?? "" });
      continue;
    }
    const stage = m ? STAGE.exec(text) : null;
    if (stage) {
      items.push({ type: "stage", date, from: stage[1] === "—" ? "" : stage[1], to: stage[2], by: stage[3] ?? "" });
      continue;
    }
    const signed = m ? /^(.*\S)\s+—\s+(\p{L}[\p{L}.'-]*)$/u.exec(text) : null;
    items.push(signed ? { type: "note", date, text: signed[1], by: signed[2] } : { type: "note", date, text });
  }
  // Touches with no matching line: in before the first item that is older.
  for (const entry of unused) {
    const at = items.findIndex((it) => it.date !== null && entry.date !== null && it.date < entry.date);
    const item: HistoryItem = { type: "touch", date: entry.date, entry };
    if (at < 0) items.push(item);
    else items.splice(at, 0, item);
  }
  return items;
}

/** "Today", "Yesterday", "3d ago", or the date, against India's today (not the browser's clock). */
export function whenLabel(date: string | null, today: string): string {
  if (!date) return "";
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days > 1 && days < 7) return `${days}d ago`;
  return displayDate(date);
}
