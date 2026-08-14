import "server-only";

import { revalidateTag } from "next/cache";

import { issueAttachmentsTag, wsTags, type CacheEntity } from "@/lib/cache-tags";

/**
 * Expire the cached reads that an API write invalidates.
 *
 * Route handlers can't call `updateTag` (Server Actions only), and API clients
 * expect read-after-write — a POST followed by a GET must show the new row. So
 * we expire immediately rather than serving stale content in the background,
 * which is the documented pattern for writes arriving from outside the app.
 * See node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md
 */
export function apiInvalidate(
  workspaceId: string,
  ...entities: CacheEntity[]
): void {
  for (const tag of wsTags(workspaceId, ...entities)) {
    revalidateTag(tag, { expire: 0 });
  }
}

/** Attachments are cached per issue rather than per workspace. */
export function apiInvalidateAttachments(issueId: string): void {
  revalidateTag(issueAttachmentsTag(issueId), { expire: 0 });
}
