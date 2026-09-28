import type { OrgRole } from "./api";

export type FlatRole = { role: OrgRole; depth: number; parentId: string | null; reports: number };

/** Depth-first, in chart order, skipping the children of collapsed roles. */
export function flattenRoles(roots: OrgRole[], collapsed: ReadonlySet<string>): FlatRole[] {
  const out: FlatRole[] = [];
  const walk = (nodes: OrgRole[], depth: number, parentId: string | null) => {
    for (const n of nodes) {
      out.push({ role: n, depth, parentId, reports: countReports(n) });
      if (!collapsed.has(n.id)) walk(n.children, depth + 1, n.id);
    }
  };
  walk(roots, 0, null);
  return out;
}

/** Everyone below a role, at any depth. */
export function countReports(role: OrgRole): number {
  return role.children.reduce((n, c) => n + 1 + countReports(c), 0);
}

/** The ids of a role and everything under it — none of these can become its parent. */
export function subtreeIds(role: OrgRole): Set<string> {
  const ids = new Set<string>([role.id]);
  const walk = (r: OrgRole) => r.children.forEach((c) => (ids.add(c.id), walk(c)));
  walk(role);
  return ids;
}

/** Every role with its parent id, flattened regardless of collapse. */
export function allRoles(roots: OrgRole[]): FlatRole[] {
  return flattenRoles(roots, new Set());
}

/** Positions a person holds, by title. */
export function positionsOf(roots: OrgRole[], userId: string): string[] {
  return allRoles(roots)
    .filter((f) => f.role.user?.id === userId)
    .map((f) => f.role.title);
}
