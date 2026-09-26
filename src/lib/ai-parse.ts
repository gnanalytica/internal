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
