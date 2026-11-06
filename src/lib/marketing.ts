/**
 * What Marketing makes and where it goes: the channels a piece can go out on,
 * the formats it can take (and the fields each one asks for), the four steps
 * from idea to posted, and the date arithmetic the content calendar runs on.
 *
 * Pure — no database, no React — so the calendar's bucketing and pacing are
 * unit-tested here and the page only draws them.
 *
 * Days are India days: the team plans in IST, and a server in UTC and a laptop
 * anywhere must put a 00:30 post on the same square.
 */
import type { Tone } from "@/lib/tones";

// ---- Statuses ----

/**
 * The stored ids predate the redesign (idea|draft|scheduled|published); the
 * labels are what the team says. Ready is indigo so it never reads as
 * LinkedIn's blue.
 */
export const PIECE_STATUSES = [
  { id: "idea", label: "Idea", tone: "gray" },
  { id: "draft", label: "Drafting", tone: "amber" },
  { id: "scheduled", label: "Ready", tone: "indigo" },
  { id: "published", label: "Posted", tone: "green" },
] as const satisfies readonly { id: string; label: string; tone: Tone }[];

export type PieceStatus = (typeof PIECE_STATUSES)[number]["id"];

export function statusOf(id: string | null | undefined) {
  return PIECE_STATUSES.find((s) => s.id === id) ?? PIECE_STATUSES[0];
}

// ---- Formats ----

export const CONTENT_FORMATS = ["post", "reel", "article", "email", "pdf", "webinar", "message"] as const;
export type ContentFormat = (typeof CONTENT_FORMATS)[number];

export type FieldKind = "text" | "long" | "url" | "datetime";
export type FormatField = { key: string; label: string; kind: FieldKind; placeholder?: string };

type FormatDef = {
  label: string;
  plural: string;
  /** One line for "what each format asks for". */
  asks: string;
  /** What "goes out" means for this format, when it means something sharper. */
  whenLabel?: string;
  fields: FormatField[];
};

/**
 * Each format's own fields, stored by key in `details`. The draft link,
 * owner, date, call to action and "also share as" are common to every piece
 * and live outside this list.
 */
export const FORMATS: Record<ContentFormat, FormatDef> = {
  post: {
    label: "Post",
    plural: "Posts",
    asks: "text, image or carousel, hashtags, best time",
    fields: [
      { key: "text", label: "Post text", kind: "long" },
      { key: "image", label: "Image or carousel link", kind: "url", placeholder: "https://" },
      { key: "hashtags", label: "Hashtags", kind: "text", placeholder: "#valuation #IBA" },
      { key: "bestTime", label: "Best time to post", kind: "text", placeholder: "Weekdays, 9–10 am" },
    ],
  },
  reel: {
    label: "Reel",
    plural: "Reels",
    asks: "script, video, cover note, caption",
    fields: [
      { key: "script", label: "Script", kind: "long" },
      { key: "video", label: "Video link", kind: "url", placeholder: "https://" },
      { key: "cover", label: "Cover note", kind: "text", placeholder: "Which frame, what text on it" },
      { key: "caption", label: "Caption", kind: "long" },
    ],
  },
  article: {
    label: "Article",
    plural: "Articles",
    asks: "draft link, search phrase, call to action",
    fields: [{ key: "searchPhrase", label: "Search phrase it should rank for", kind: "text", placeholder: "IBA valuation report format" }],
  },
  email: {
    label: "Email",
    plural: "Emails",
    asks: "subject, preview line, list, send time",
    whenLabel: "Send time",
    fields: [
      { key: "subject", label: "Subject", kind: "text" },
      { key: "preview", label: "Preview line", kind: "text", placeholder: "The line after the subject in the inbox" },
      { key: "list", label: "List", kind: "text", placeholder: "Who it goes to" },
    ],
  },
  pdf: {
    label: "Gated PDF",
    plural: "Gated PDFs",
    asks: "file, form fields, where it is linked",
    fields: [
      { key: "file", label: "File link", kind: "url", placeholder: "https://" },
      { key: "formFields", label: "Form asks for", kind: "text", placeholder: "Name, phone" },
      { key: "linkedFrom", label: "Where it is linked", kind: "text", placeholder: "Blog 1, WhatsApp group" },
    ],
  },
  webinar: {
    label: "Webinar",
    plural: "Webinars",
    asks: "date, speaker, sign-up link, recording",
    fields: [
      { key: "date", label: "Webinar date", kind: "datetime" },
      { key: "speaker", label: "Speaker", kind: "text" },
      { key: "signup", label: "Sign-up link", kind: "url", placeholder: "https://" },
      { key: "recording", label: "Recording link", kind: "url", placeholder: "https://" },
    ],
  },
  message: {
    label: "WhatsApp message",
    plural: "Messages",
    asks: "the message text",
    fields: [{ key: "text", label: "Message", kind: "long" }],
  },
};

export function asFormat(v: string | null | undefined): ContentFormat | null {
  return (CONTENT_FORMATS as readonly string[]).includes(v ?? "") ? (v as ContentFormat) : null;
}

/** The fields a format asks for; none when the piece has no format yet. */
export function fieldsFor(format: string | null | undefined): FormatField[] {
  const f = asFormat(format);
  return f ? FORMATS[f].fields : [];
}

// ---- Channels ----

export const CHANNELS = [
  { id: "linkedin", label: "LinkedIn", note: "Post · carousel", share: "LinkedIn post", tone: "blue" },
  { id: "instagram", label: "Instagram", note: "Reel · post", share: "Instagram post", tone: "pink" },
  { id: "whatsapp", label: "WhatsApp group", note: "Message to members", share: "WhatsApp message", tone: "green" },
  { id: "blog", label: "Blog", note: "Article", share: "Blog article", tone: "violet" },
  { id: "email", label: "Newsletter", note: "Email", share: "Newsletter", tone: "amber" },
  { id: "download", label: "Downloads", note: "Gated PDF", share: "Download", tone: "gray" },
  { id: "video", label: "Video / webinar", note: "Webinar · recording", share: "Video", tone: "teal" },
] as const satisfies readonly { id: string; label: string; note: string; share: string; tone: Tone }[];

export type ChannelId = (typeof CHANNELS)[number]["id"];
export type Channel = (typeof CHANNELS)[number];

export function channelOf(id: string | null | undefined): Channel | null {
  return CHANNELS.find((c) => c.id === id) ?? null;
}

/**
 * The format a piece on each channel usually takes. Seeds a new piece's
 * format, and is the backfill in src/db/add-content-format.ts.
 */
export const CHANNEL_FORMAT: Record<ChannelId, ContentFormat> = {
  linkedin: "post",
  instagram: "post",
  whatsapp: "message",
  blog: "article",
  email: "email",
  download: "pdf",
  video: "webinar",
};

/** A piece's format, falling back to its channel's usual one for rows saved before formats existed. */
export function formatOf(p: { format: string | null; channel: string | null }): ContentFormat | null {
  return asFormat(p.format) ?? (channelOf(p.channel) ? CHANNEL_FORMAT[p.channel as ChannelId] : null);
}

// ---- Details ----

/** Format fields by key, plus the two every piece has. */
export type ContentDetails = {
  cta?: string | null;
  /** Channel ids the piece is also cut down for. */
  shareAs?: string[];
  [field: string]: string | string[] | null | undefined;
};

export const CTA_OPTIONS = [
  "Join the WhatsApp group",
  "Download the checklist",
  "Book a demo",
  "Register for the webinar",
  "Read the blog",
] as const;

export function detailText(d: ContentDetails | null | undefined, key: string): string {
  const v = d?.[key];
  return typeof v === "string" ? v : "";
}

// ---- Dates (IST) ----

const IST_MS = 5.5 * 3600_000;

type When = Date | string | null | undefined;

const toMs = (d: When): number | null => {
  if (!d) return null;
  const ms = typeof d === "string" ? Date.parse(d) : d.getTime();
  return Number.isNaN(ms) ? null : ms;
};

/** yyyy-mm-dd of the India day a timestamp falls on. */
export function dayOf(d: When): string | null {
  const ms = toMs(d);
  return ms === null ? null : new Date(ms + IST_MS).toISOString().slice(0, 10);
}

/** "09:30" in India time. */
export function timeOf(d: When): string | null {
  const ms = toMs(d);
  return ms === null ? null : new Date(ms + IST_MS).toISOString().slice(11, 16);
}

export function todayIST(now = Date.now()): string {
  return new Date(now + IST_MS).toISOString().slice(0, 10);
}

/** The value a `datetime-local` input shows for a timestamp, in India time. */
export function toIstInput(d: When): string {
  const ms = toMs(d);
  return ms === null ? "" : new Date(ms + IST_MS).toISOString().slice(0, 16);
}

/** A `datetime-local` value read as India time, back to an ISO timestamp. */
export function fromIstInput(v: string | null | undefined): string | null {
  if (!v) return null;
  const ms = Date.parse(`${v.length === 10 ? `${v}T10:00` : v}:00+05:30`);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/** A piece moved to `day` keeps its time of day; one with no time yet goes out at 10:00. */
export function atDay(day: string, keepTimeFrom?: When): string {
  return fromIstInput(`${day}T${timeOf(keepTimeFrom) ?? "10:00"}`)!;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The Monday on or before `iso`. */
export function weekStart(iso: string): string {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(iso, dow === 0 ? -6 : 1 - dow);
}

export function weekDays(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Monday-first weeks covering the month `yyyy-mm`, padded with the neighbouring months' days. */
export function monthWeeks(month: string): string[][] {
  const first = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const weeks: string[][] = [];
  for (let s = weekStart(first); s <= last; s = addDays(s, 7)) weeks.push(weekDays(s));
  return weeks;
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

const DAY_FMT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone: "UTC" };
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** "9 – 15 Nov", or "30 Nov – 6 Dec" across a month end. */
export function weekLabel(start: string): string {
  const end = addDays(start, 6);
  if (start.slice(0, 7) === end.slice(0, 7)) return `${Number(start.slice(8))} – ${utc(end).toLocaleDateString("en-GB", DAY_FMT)}`;
  return `${utc(start).toLocaleDateString("en-GB", DAY_FMT)} – ${utc(end).toLocaleDateString("en-GB", DAY_FMT)}`;
}

/** "Thu 12 Nov" for a day key. */
export function dayLabel(iso: string): string {
  return utc(iso).toLocaleDateString("en-GB", { weekday: "short", ...DAY_FMT });
}

export function monthLabel(month: string): string {
  return utc(`${month}-01`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

// ---- Calendar maths ----

type Dated = { channel: string | null; publishDate: When; status: string };

/** The row a piece sits in: its channel, or "other" when it has none we know. */
export const rowOf = (p: { channel: string | null }): string => (channelOf(p.channel) ? p.channel! : "other");

/** Pieces dated within `days`, by row then by day. Pieces with no date are left out — they are ideas. */
export function bucketByDay<T extends Dated>(items: T[], days: string[]): Map<string, Map<string, T[]>> {
  const inRange = new Set(days);
  const out = new Map<string, Map<string, T[]>>();
  for (const p of items) {
    const day = dayOf(p.publishDate);
    if (!day || !inRange.has(day)) continue;
    const row = rowOf(p);
    if (!out.has(row)) out.set(row, new Map());
    const byDay = out.get(row)!;
    byDay.set(day, [...(byDay.get(day) ?? []), p]);
  }
  for (const byDay of out.values()) for (const list of byDay.values()) list.sort((a, b) => (toMs(a.publishDate) ?? 0) - (toMs(b.publishDate) ?? 0));
  return out;
}

export type Pace = { channel: string; label: string; tone: Tone; done: number; plan: number };

/**
 * This week against plan, per channel: everything dated in the week is the
 * plan, the posted ones are done. Derived from the pieces alone; channels with
 * nothing planned are left out.
 */
export function weekPace(items: Dated[], start: string): Pace[] {
  const days = new Set(weekDays(start));
  const rows = [...CHANNELS.map((c) => ({ channel: c.id as string, label: c.label as string, tone: c.tone as Tone })), { channel: "other", label: "No channel", tone: "gray" as Tone }];
  return rows
    .map((r) => {
      const mine = items.filter((p) => rowOf(p) === r.channel && days.has(dayOf(p.publishDate) ?? ""));
      return { ...r, plan: mine.length, done: mine.filter((p) => p.status === "published").length };
    })
    .filter((r) => r.plan > 0);
}

/** Posted pieces per row for the `weeks` weeks ending with the one starting `lastStart`, oldest first. */
export function weeklyPosted(items: Dated[], lastStart: string, weeks = 8): Map<string, number[]> {
  const starts = Array.from({ length: weeks }, (_, i) => addDays(lastStart, (i - weeks + 1) * 7));
  const out = new Map<string, number[]>();
  for (const p of items) {
    if (p.status !== "published") continue;
    const day = dayOf(p.publishDate);
    if (!day) continue;
    const i = starts.indexOf(weekStart(day));
    if (i < 0) continue;
    const row = rowOf(p);
    if (!out.has(row)) out.set(row, Array(weeks).fill(0));
    out.get(row)![i]++;
  }
  return out;
}
