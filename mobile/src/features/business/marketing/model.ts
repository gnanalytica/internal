/**
 * The phone's copy of the web's Marketing rules (src/lib/marketing.ts): the
 * channels a piece goes out on, the formats it takes, the four steps from idea
 * to posted, and the India-day calendar maths. The app is its own project and
 * cannot import the web's modules, so src/lib/marketing-mobile-parity.test.ts
 * fails the moment the two copies disagree.
 *
 * Pure — no React — and days are India days, as on the web.
 */

/** The web's tone names, as the hex of the Tailwind shade its dots and bars use. */
export const TONE_HEX = {
  gray: "#a1a1aa",
  blue: "#0ea5e9",
  violet: "#8b5cf6",
  indigo: "#6366f1",
  teal: "#14b8a6",
  green: "#10b981",
  amber: "#f59e0b",
  orange: "#f97316",
  red: "#ef4444",
  pink: "#ec4899",
} as const;
export type Tone = keyof typeof TONE_HEX;

// ---- Statuses ----

export const PIECE_STATUSES = [
  { id: "idea", label: "Idea", tone: "gray" },
  { id: "draft", label: "Drafting", tone: "amber" },
  { id: "scheduled", label: "Ready", tone: "indigo" },
  { id: "published", label: "Posted", tone: "green" },
] as const satisfies readonly { id: string; label: string; tone: Tone }[];

export function statusOf(id: string | null | undefined) {
  return PIECE_STATUSES.find((s) => s.id === id) ?? PIECE_STATUSES[0];
}

// ---- Formats ----

export const CONTENT_FORMATS = ["post", "reel", "article", "email", "pdf", "webinar", "message"] as const;
export type ContentFormat = (typeof CONTENT_FORMATS)[number];

/** Each format's name and what it asks for (the web's editor holds the per-format fields). */
export const FORMATS: Record<ContentFormat, { label: string; plural: string; asks: string }> = {
  post: { label: "Post", plural: "Posts", asks: "text, image or carousel, hashtags, best time" },
  reel: { label: "Reel", plural: "Reels", asks: "script, video, cover note, caption" },
  article: { label: "Article", plural: "Articles", asks: "draft link, search phrase, call to action" },
  email: { label: "Email", plural: "Emails", asks: "subject, preview line, list, send time" },
  pdf: { label: "Gated PDF", plural: "Gated PDFs", asks: "file, form fields, where it is linked" },
  webinar: { label: "Webinar", plural: "Webinars", asks: "date, speaker, sign-up link, recording" },
  message: { label: "WhatsApp message", plural: "Messages", asks: "the message text" },
};

export function asFormat(v: string | null | undefined): ContentFormat | null {
  return (CONTENT_FORMATS as readonly string[]).includes(v ?? "") ? (v as ContentFormat) : null;
}

// ---- Channels ----

export const CHANNELS = [
  { id: "linkedin", label: "LinkedIn", note: "Post · carousel", tone: "blue" },
  { id: "instagram", label: "Instagram", note: "Reel · post", tone: "pink" },
  { id: "whatsapp", label: "WhatsApp group", note: "Message to members", tone: "green" },
  { id: "blog", label: "Blog", note: "Article", tone: "violet" },
  { id: "email", label: "Newsletter", note: "Email", tone: "amber" },
  { id: "download", label: "Downloads", note: "Gated PDF", tone: "gray" },
  { id: "video", label: "Video / webinar", note: "Webinar · recording", tone: "teal" },
] as const satisfies readonly { id: string; label: string; note: string; tone: Tone }[];

export type ChannelId = (typeof CHANNELS)[number]["id"];
export type Channel = (typeof CHANNELS)[number];

export function channelOf(id: string | null | undefined): Channel | null {
  return CHANNELS.find((c) => c.id === id) ?? null;
}

/** The format a piece on each channel usually takes; seeds a new piece's format. */
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
export function formatOf(p: { format?: string | null; channel: string | null }): ContentFormat | null {
  return asFormat(p.format) ?? (channelOf(p.channel) ? CHANNEL_FORMAT[p.channel as ChannelId] : null);
}

/** "Article · Blog", or whichever half is known. */
export function formatChannelLabel(p: { format?: string | null; channel: string | null }): string {
  const f = formatOf(p);
  return [f ? FORMATS[f].label : null, channelOf(p.channel)?.label ?? p.channel].filter(Boolean).join(" · ") || "No format yet";
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

/** "yyyy-mm-ddThh:mm" (or a bare day, read as 10:00) in India time, back to an ISO timestamp. */
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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
// Spelled out rather than through toLocaleDateString: Hermes on Android ships without full Intl data.
const dm = (iso: string) => `${utc(iso).getUTCDate()} ${MONTHS[utc(iso).getUTCMonth()]}`;

/** "9 – 15 Nov", or "30 Nov – 6 Dec" across a month end. */
export function weekLabel(start: string): string {
  const end = addDays(start, 6);
  if (start.slice(0, 7) === end.slice(0, 7)) return `${Number(start.slice(8))} – ${dm(end)}`;
  return `${dm(start)} – ${dm(end)}`;
}

/** "Thu 12 Nov" for a day key. */
export function dayLabel(iso: string): string {
  return `${WEEKDAYS[utc(iso).getUTCDay()]} ${dm(iso)}`;
}

// ---- Calendar maths ----

type Dated = { channel: string | null; publishDate: When; status: string };

/** The row a piece sits in: its channel, or "other" when it has none we know. */
export const rowOf = (p: { channel: string | null }): string => (channelOf(p.channel) ? p.channel! : "other");

export type Pace = { channel: string; label: string; tone: Tone; done: number; plan: number };

/**
 * This week against plan, per channel: everything dated in the week is the
 * plan, the posted ones are done. Channels with nothing planned are left out.
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

// ---- Overdue ----

/** A piece whose India day has passed and that still hasn't gone out. Ideas have no date, so are never overdue. */
export function isOverdue(p: { publishDate: When; status: string }, today: string): boolean {
  const day = dayOf(p.publishDate);
  return day !== null && day < today && p.status !== "published";
}

/** Overdue pieces, the latest-running first. */
export function overdue<T extends { publishDate: When; status: string }>(items: T[], today: string): T[] {
  return items.filter((p) => isOverdue(p, today)).sort((a, b) => (toMs(a.publishDate) ?? 0) - (toMs(b.publishDate) ?? 0));
}

/** Whole India days from a piece's day to `today`; 0 when it isn't behind. */
export function daysLate(publishDate: When, today: string): number {
  const day = dayOf(publishDate);
  if (!day || day >= today) return 0;
  return Math.round((utc(today).getTime() - utc(day).getTime()) / 86_400_000);
}

/** "1 day late", "12 days late", then "1 month late", "2 months late" once it runs past four weeks. */
export function lateLabel(publishDate: When, today: string): string {
  const days = daysLate(publishDate, today);
  if (days < 30) return `${days} ${days === 1 ? "day" : "days"} late`;
  const months = Math.floor(days / 30);
  return `${months} ${months === 1 ? "month" : "months"} late`;
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
