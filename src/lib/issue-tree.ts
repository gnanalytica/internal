/**
 * Pure helpers for surfacing sub-issues (`issues.parentId`) in list/board views.
 * Kept side-effect-free and view-agnostic so nesting behavior is unit-tested.
 */

type Node = { id: string; parentId: string | null; status: string };

/** Done/total children of a parent, counted from the full flat issue set. */
export function subIssueProgress<T extends Node>(parentId: string, all: T[]) {
  const kids = all.filter((i) => i.parentId === parentId);
  return { done: kids.filter((k) => k.status === "done").length, total: kids.length };
}

/**
 * Nest one group's issues into top-level rows with their in-group children.
 * A child nests under its parent only when the parent is also in `groupItems`;
 * otherwise it stays a top-level row (so a parent and child in different
 * groups/columns both render). Returns the set of child ids suppressed from the
 * top level so callers can skip re-rendering them.
 */
export function nestGroup<T extends Node>(groupItems: T[]) {
  const inGroup = new Set(groupItems.map((i) => i.id));
  const childrenByParent = new Map<string, T[]>();
  const suppressed = new Set<string>();
  for (const i of groupItems) {
    if (i.parentId && inGroup.has(i.parentId)) {
      const arr = childrenByParent.get(i.parentId) ?? [];
      arr.push(i);
      childrenByParent.set(i.parentId, arr);
      suppressed.add(i.id);
    }
  }
  const rows = groupItems
    .filter((i) => !suppressed.has(i.id))
    .map((issue) => ({ issue, children: childrenByParent.get(issue.id) ?? [] }));
  return { rows, suppressed };
}
