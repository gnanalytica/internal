/**
 * The pure half of `GET /api/v1/search`: what a hit carries, which hits a
 * caller may see, and where each one lives on the web. Kept free of the
 * database so the visibility and shaping rules can be unit-tested.
 */
import { canSeeProject, canSeeSales, type ApiScope } from "./scope-rules";

export const SEARCH_TYPES = [
  "issue",
  "page",
  "project",
  "database",
  "cycle",
  "milestone",
  "feature",
  "ticket",
  "deal",
  "account",
  "contact",
] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

export type SearchField = { label: string; value: string };

export type SearchHit = {
  type: SearchType;
  id: string;
  title: string;
  /** One line of context: identifier, project, status — whatever tells two hits apart. */
  subtitle: string | null;
  /** The owning project, when the record has one. */
  projectId: string | null;
  /** A few label/value facts, enough to show the record without another request. */
  fields: SearchField[];
  url: string;
};

/** Where a hit lives on the web app. Relative to `base` (the app's origin). */
export function webPath(type: SearchType, id: string, projectId: string | null): string {
  switch (type) {
    case "issue":
      return `/issues/${id}`;
    case "page":
      return `/pages/${id}`;
    case "project":
      return `/projects/${id}`;
    case "database":
      return `/databases/${id}`;
    case "cycle":
      return projectId ? `/projects/${projectId}/cycles` : "/cycles";
    case "milestone":
      return projectId ? `/projects/${projectId}/milestones/${id}` : `/milestones/${id}`;
    case "feature":
      return projectId ? `/projects/${projectId}/product/${id}` : `/features/${id}`;
    case "ticket":
      return projectId ? `/projects/${projectId}/customer-success` : `/tickets/${id}`;
    case "deal":
      return projectId ? `/projects/${projectId}/sales` : `/deals/${id}`;
    case "account":
      return `/accounts/${id}`;
    case "contact":
      return `/contacts/${id}`;
  }
}

/** Sales records (deals) are for admins, as on the web. */
const SALES_TYPES: ReadonlySet<SearchType> = new Set(["deal"]);

/**
 * Drop what the caller may not see: anything inside a confidential project (a
 * project hit is "inside" itself), and deals for a member. Order is preserved.
 */
export function visibleHits(hits: SearchHit[], scope: ApiScope): SearchHit[] {
  return hits.filter((h) => {
    if (SALES_TYPES.has(h.type) && !canSeeSales(scope)) return false;
    return canSeeProject(scope, h.type === "project" ? h.id : h.projectId);
  });
}

/** Keep only the facts that have a value. */
export function fields(...pairs: [string, string | number | null | undefined][]): SearchField[] {
  return pairs
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
    .map(([label, v]) => ({ label, value: String(v) }));
}

/** "in_progress" → "In progress". */
export function humanize(value: string | null | undefined): string | null {
  if (!value) return null;
  const s = value.replace(/[_-]+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : null;
}

/** yyyy-mm-dd, or null. */
export function isoDay(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

/** Join the non-empty parts of a subtitle with a middle dot. */
export function subtitle(...parts: (string | null | undefined)[]): string | null {
  const s = parts.filter((p): p is string => !!p && p.trim() !== "").join(" · ");
  return s || null;
}
