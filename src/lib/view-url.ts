/**
 * The task list's view in the URL, so a link opens the same view: filters as
 * comma lists, plus group, sort and layout when they differ from the default.
 * Other query params (e.g. `?project=`) are left alone. Pure, for testing.
 */

const LISTS = ["status", "priority", "type", "assignee", "label", "cycle", "milestone", "blocked"] as const;
const SINGLES = ["sort", "group", "view"] as const;

export type UrlView = Record<(typeof LISTS)[number], string[]> & Record<(typeof SINGLES)[number], string>;

/** The view a URL asks for, or null when it carries none of these params. */
export function readViewFromUrl(search: string): UrlView | null {
  const q = new URLSearchParams(search);
  if (![...LISTS, ...SINGLES].some((k) => q.has(k))) return null;
  const list = (k: string) => (q.get(k) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return {
    status: list("status"),
    priority: list("priority"),
    type: list("type"),
    assignee: list("assignee"),
    label: list("label"),
    cycle: list("cycle"),
    milestone: list("milestone"),
    blocked: list("blocked"),
    sort: q.get("sort") ?? "",
    group: q.get("group") ?? "",
    view: q.get("view") ?? "",
  };
}

/** `search` with the view params replaced; empty values are dropped. No leading "?". */
export function writeViewToUrl(search: string, v: UrlView): string {
  const q = new URLSearchParams(search);
  for (const k of LISTS) {
    if (v[k].length) q.set(k, [...v[k]].sort().join(","));
    else q.delete(k);
  }
  for (const k of SINGLES) {
    if (v[k]) q.set(k, v[k]);
    else q.delete(k);
  }
  return q.toString().replace(/%2C/gi, ",");
}
