/**
 * Pull the first JSON array out of a model response. Models sometimes wrap JSON
 * in prose or ```json fences, so we locate the outermost [ ... ] and parse it.
 * Returns [] on failure rather than throwing.
 */
export function extractJsonArray<T = unknown>(text: string): T[] {
  if (!text) return [];
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/** Coerce a proposed issue from the model into a clean { title, description }. */
export function normalizeProposedIssue(
  raw: unknown,
): { title: string; description: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = typeof r.title === "string" ? r.title.trim() : "";
  if (!title) return null;
  const description = typeof r.description === "string" ? r.description.trim() : "";
  return { title: title.slice(0, 200), description: description.slice(0, 2000) };
}
