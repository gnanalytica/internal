import { canSeeDepartment, isDepartmentEnabled } from "@/lib/departments";
import { PROSPECTS_PRODUCT_KEY } from "./schema";

/**
 * The project whose Sales page holds the prospects, if this person may see it.
 *
 * Surfaces outside that page (home, search) show prospects too, so they ask
 * the same two questions the page does: is Sales switched on for the
 * product, and does the department rule let this role in. `null` means show
 * nothing.
 */
export function salesProjectId(projects: { id: string; key: string; enabledDepartments: string[] | null }[], role: string): string | null {
  const p = projects.find((x) => x.key === PROSPECTS_PRODUCT_KEY);
  if (!p || !isDepartmentEnabled(p.enabledDepartments, "sales") || !canSeeDepartment("sales", role)) return null;
  return p.id;
}

/** One prospect in the ⌘K palette's results. */
export type ProspectHit = { key: string; title: string; subtitle: string; href: string };

/** The record page for one prospect, as every link to it is written. */
export function prospectHref(projectId: string, r: { kind: string; id: string }): string {
  return `/projects/${projectId}/sales?rec=${encodeURIComponent(`${r.kind}:${r.id}`)}`;
}
