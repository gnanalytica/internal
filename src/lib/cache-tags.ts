/**
 * Cache tags for the workspace-scoped reads in `src/lib/data.ts`.
 *
 * Every cached read tags itself with the entities it touches; every mutation in
 * `src/lib/actions.ts` calls `updateTag` for the entities it wrote. Tags are
 * namespaced per workspace so one workspace's writes never invalidate another's
 * cache entries.
 *
 * Only user-independent reads are cached. Anything that resolves the signed-in
 * user (`getWorkspace`, `getMyRole`, `getFavorites`, `getUnreadCount`, …) stays
 * uncached — a cache keyed on `workspaceId` alone would serve one member's data
 * to another.
 */

export const CACHE_ENTITIES = [
  "api", // API keys + webhooks
  "attachments",
  "campaigns", // campaigns + content calendar
  "crm", // accounts, contacts, deals
  "cycles",
  "databases",
  "features",
  "feedback",
  "finance", // invoices + expenses
  "issues",
  "labels",
  "members",
  "metrics",
  "milestones",
  "org", // org chart roles + membership metadata
  "pages",
  "projects",
  "saved-views",
  "status-updates",
  "tickets",
] as const;

export type CacheEntity = (typeof CACHE_ENTITIES)[number];

/** The tag for one entity within one workspace. */
export function wsTag(workspaceId: string, entity: CacheEntity): string {
  return `ws:${workspaceId}:${entity}`;
}

/**
 * Tags for several entities at once. Spread into `cacheTag` when a read joins
 * across entities, or into `updateTag` when a mutation touches more than one:
 *
 *     cacheTag(...wsTags(workspaceId, "projects", "issues"));
 */
export function wsTags(
  workspaceId: string,
  ...entities: CacheEntity[]
): string[] {
  return entities.map((e) => wsTag(workspaceId, e));
}

/**
 * Attachments are looked up by issue rather than by workspace, so they get
 * their own tag namespace keyed on the issue.
 */
export function issueAttachmentsTag(issueId: string): string {
  return `issue:${issueId}:attachments`;
}
