/**
 * The pure half of org-chart edits through the API, mirroring the web's
 * `updateOrgRole` / `deleteOrgRole` guards.
 */

/**
 * Whether making `parentId` the parent of `id` would put `id` among its own
 * ancestors — a loop that detaches the whole subtree from the chart.
 * `parentOf` maps every role id to its current parent.
 */
export function wouldCreateLoop(parentOf: ReadonlyMap<string, string | null>, id: string, parentId: string | null): boolean {
  if (!parentId) return false;
  const seen = new Set<string>();
  let cursor: string | null = parentId;
  while (cursor) {
    if (cursor === id) return true;
    if (seen.has(cursor)) return true; // an existing loop: refuse to extend it
    seen.add(cursor);
    cursor = parentOf.get(cursor) ?? null;
  }
  return false;
}
