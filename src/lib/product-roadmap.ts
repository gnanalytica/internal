/**
 * The pure parts of Product's Roadmap and Feedback tabs: which column a
 * feature sits in, how its tickets roll up, which bucket a piece of feedback
 * came from and how feedback groups into themes. No React, no DB — tested in
 * `product-roadmap.test.ts`.
 */
import { featureProgress } from "@/lib/feature-progress";
import type { Tone } from "@/lib/tones";

// ---- Roadmap ----

/** The three open columns, left to right. A feature's status is its column. */
export const ROADMAP_COLUMNS = [
  { id: "building", label: "Now", hint: "building", tone: "amber" },
  { id: "planned", label: "Next", hint: "decided", tone: "indigo" },
  { id: "idea", label: "Later", hint: "maybe", tone: "gray" },
] as const satisfies readonly { id: string; label: string; hint: string; tone: Tone }[];

export type RoadmapStatus = (typeof ROADMAP_COLUMNS)[number]["id"] | "shipped";

/** Where a drop can land: the three columns plus the Shipped row. */
export const ROADMAP_DROP_STATUSES: RoadmapStatus[] = ["building", "planned", "idea", "shipped"];

export const isRoadmapStatus = (v: string): v is RoadmapStatus =>
  (ROADMAP_DROP_STATUSES as string[]).includes(v);

/**
 * Split features into the three columns plus Shipped. Archived features (and
 * anything with a status the roadmap doesn't know) are left out. Order within
 * a column is the order given.
 */
export function groupRoadmap<T extends { status: string }>(
  features: T[],
): { columns: Record<"building" | "planned" | "idea", T[]>; shipped: T[] } {
  const columns = { building: [] as T[], planned: [] as T[], idea: [] as T[] };
  const shipped: T[] = [];
  for (const f of features) {
    if (f.status === "shipped") shipped.push(f);
    else if (f.status === "building" || f.status === "planned" || f.status === "idea") columns[f.status].push(f);
  }
  return { columns, shipped };
}

export type Progress = { done: number; total: number; pct: number };

/** Ticket progress per feature id, from the linked issues (canceled ones don't count). */
export function progressByFeature(
  issues: { featureId: string | null; status: string }[],
): Map<string, Progress> {
  const grouped = new Map<string, { status: string }[]>();
  for (const i of issues) {
    if (!i.featureId) continue;
    (grouped.get(i.featureId) ?? grouped.set(i.featureId, []).get(i.featureId)!).push(i);
  }
  return new Map([...grouped].map(([id, list]) => [id, featureProgress(list)]));
}

/** How many pieces of feedback point at each feature. */
export function voicesByFeature(items: { featureId: string | null }[]): Map<string, number> {
  const n = new Map<string, number>();
  for (const i of items) if (i.featureId) n.set(i.featureId, (n.get(i.featureId) ?? 0) + 1);
  return n;
}

export const voicesLabel = (n: number) => (n === 0 ? "No voices yet" : n === 1 ? "1 voice" : `${n} voices`);

export const ticketsLabel = (p: { done: number; total: number }) =>
  p.total === 0 ? "No tickets yet" : `${p.done} of ${p.total} ticket${p.total === 1 ? "" : "s"}`;

// ---- Feedback: where it came from ----

/**
 * The four ways the team talks about where feedback came from. Six stored
 * sources fold into four: support is a customer talking, "other" is the team.
 */
export const SOURCE_BUCKETS = [
  { id: "prospects", label: "From prospects", sources: ["sales"], tone: "blue" },
  { id: "customers", label: "From customers", sources: ["customer", "support"], tone: "orange" },
  { id: "interviews", label: "Interviews", sources: ["interview"], tone: "violet" },
  { id: "team", label: "Team", sources: ["internal", "other"], tone: "gray" },
] as const satisfies readonly { id: string; label: string; sources: readonly string[]; tone: Tone }[];

export type SourceBucketId = (typeof SOURCE_BUCKETS)[number]["id"];

/** The bucket a stored source falls in; anything unknown counts as the team's. */
export function sourceBucket(source: string): (typeof SOURCE_BUCKETS)[number] {
  return SOURCE_BUCKETS.find((b) => (b.sources as readonly string[]).includes(source)) ?? SOURCE_BUCKETS[3];
}

export function countBySourceBucket(items: { source: string }[]): Record<SourceBucketId, number> {
  const counts: Record<SourceBucketId, number> = { prospects: 0, customers: 0, interviews: 0, team: 0 };
  for (const i of items) counts[sourceBucket(i.source).id] += 1;
  return counts;
}

// ---- Feedback: themes ----

type ThemeInput = { id: string; title: string; theme: string | null; featureId: string | null };

/** An item's theme: its own, or its title before themes existed. */
export const themeOf = (i: { title: string; theme: string | null }) => (i.theme?.trim() || i.title.trim() || "Untitled");

/** The words of a quote: its body, or its title for items logged before bodies were used. */
export const quoteText = (f: { body: string | null; title: string }) => f.body?.trim() || f.title.trim();

/** A title for a new item, from its quote: the first line, cut at a word near 80 characters. */
export function titleFromQuote(quote: string): string {
  const line = quote.trim().split("\n")[0].trim();
  if (line.length <= 80) return line;
  const cut = line.slice(0, 80);
  const space = cut.lastIndexOf(" ");
  return `${(space > 40 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Themes match whatever the case and spacing, so "Pricing" and "pricing " are one. */
export const themeKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

export type ThemeGroup<T> = {
  key: string;
  /** As first written. */
  name: string;
  items: T[];
  /** The feature most of the theme's items point at, or null when none are linked. */
  featureId: string | null;
  /** True when some items point elsewhere (or nowhere) while others are linked. */
  mixed: boolean;
};

/**
 * Group feedback into themes, biggest first (ties by name). Items keep the
 * order given within a theme, so pass them sorted the way quotes should read.
 */
export function groupByTheme<T extends ThemeInput>(items: T[]): ThemeGroup<T>[] {
  const groups = new Map<string, { name: string; items: T[] }>();
  for (const i of items) {
    const name = themeOf(i);
    const key = themeKey(name);
    const g = groups.get(key);
    if (g) g.items.push(i);
    else groups.set(key, { name, items: [i] });
  }
  return [...groups]
    .map(([key, g]) => {
      const counts = voicesByFeature(g.items);
      let featureId: string | null = null;
      for (const [id, n] of counts) if (!featureId || n > counts.get(featureId)!) featureId = id;
      const mixed = featureId !== null && g.items.some((i) => i.featureId !== featureId);
      return { key, name: g.name, items: g.items, featureId, mixed };
    })
    .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
}

/** Distinct theme names, for the Add feedback picker; most used first. */
export function themeNames(items: ThemeInput[]): string[] {
  return groupByTheme(items).map((g) => g.name);
}

/** Existing themes matching what's been typed (all of them when nothing has). */
export function matchThemes(names: string[], q: string, limit = 8): string[] {
  const k = themeKey(q);
  return (k ? names.filter((n) => themeKey(n).includes(k)) : names).slice(0, limit);
}
