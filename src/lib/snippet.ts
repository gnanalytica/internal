/**
 * Build a short context snippet around the first occurrence of `query` in
 * `text`. Returns null when there's no match (e.g. the page matched on title
 * only), so callers can omit the subtitle.
 */
export function snippetAround(
  text: string,
  query: string,
  radius = 40,
): string | null {
  if (!text || !query) return null;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return null;
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + query.length + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}
