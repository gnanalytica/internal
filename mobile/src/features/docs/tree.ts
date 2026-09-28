import type { PageSummary } from "./api";

export type TreeNode = { page: PageSummary; depth: number; hasChildren: boolean; expanded: boolean };

/**
 * Children of each page, in the web sidebar's order. The web sorts siblings by
 * their position key, which is their creation time; the list endpoint returns
 * newest first, so its reverse is that order. A page whose parent isn't in the
 * list (trashed, or in a project this member can't see) is shown as a root.
 */
export function childrenIndex(pages: PageSummary[]): Map<string | null, PageSummary[]> {
  const ids = new Set(pages.map((p) => p.id));
  const map = new Map<string | null, PageSummary[]>();
  for (const p of [...pages].reverse()) {
    const key = p.parentId && ids.has(p.parentId) ? p.parentId : null;
    const list = map.get(key) ?? [];
    list.push(p);
    map.set(key, list);
  }
  return map;
}

/** The rows to show: roots, and the children of every expanded page. */
export function visibleTree(roots: PageSummary[], index: Map<string | null, PageSummary[]>, expanded: ReadonlySet<string>): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (list: PageSummary[], depth: number) => {
    for (const page of list) {
      const kids = index.get(page.id) ?? [];
      const open = expanded.has(page.id);
      out.push({ page, depth, hasChildren: kids.length > 0, expanded: open });
      if (open) walk(kids, depth + 1);
    }
  };
  walk(roots, 0);
  return out;
}

/** "Handbook › Onboarding" — where a page sits, for search results. */
export function pathOf(page: PageSummary, byId: Map<string, PageSummary>): string {
  const parts: string[] = [];
  let cur = page.parentId ? byId.get(page.parentId) : undefined;
  for (let guard = 0; cur && guard < 20; guard++) {
    parts.unshift(cur.title || "Untitled");
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return parts.join(" › ");
}

export function matches(page: PageSummary, q: string): boolean {
  return (page.title || "Untitled").toLowerCase().includes(q.trim().toLowerCase());
}
