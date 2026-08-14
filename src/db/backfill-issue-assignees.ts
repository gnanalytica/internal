/**
 * Backfill `issue_assignees` from `issues.assigneeId`.
 *
 * The primary assignee lives on the issue row; the full set lives in the join
 * table, and the task detail page reads only the join table. Seed scripts and
 * `updateIssue` used to write the scalar alone, so those tasks looked assigned
 * in every list and board and unassigned the moment you opened them.
 *
 * Idempotent — `onConflictDoNothing` plus the existing unique key means running
 * it twice inserts nothing the second time.
 */
import { and, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { issueAssignees, issues } from "@/db/schema";

async function main() {
  const missing = await db
    .select({ issueId: issues.id, userId: issues.assigneeId, number: issues.number })
    .from(issues)
    .leftJoin(
      issueAssignees,
      and(
        eq(issueAssignees.issueId, issues.id),
        eq(issueAssignees.userId, issues.assigneeId),
      ),
    )
    .where(and(isNotNull(issues.assigneeId), sql`${issueAssignees.issueId} is null`));

  if (missing.length === 0) {
    console.log("Nothing to backfill — every assigned task already has its join row.");
    return;
  }

  await db
    .insert(issueAssignees)
    .values(missing.map((m) => ({ issueId: m.issueId, userId: m.userId! })))
    .onConflictDoNothing();

  console.log(`Backfilled ${missing.length} assignee rows.`);
}

main().then(() => process.exit(0));
