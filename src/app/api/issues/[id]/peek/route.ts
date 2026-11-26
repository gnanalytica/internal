import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { comments, users } from "@/db/schema";
import { getIssue, getWorkspace } from "@/lib/data";
import { docToText } from "@/lib/markdown";

/**
 * What the task list's peek panel shows beyond the row it already has: the
 * description as plain text and the latest comments. A plain GET (not a server
 * action) so it runs alongside saves and is cancelled when the person moves to
 * the next task. Session-authenticated by `proxy.ts`; `getWorkspace()` checks
 * membership.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ws = await getWorkspace();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Not found" }, { status: 404 });
  const issue = await getIssue(ws.id, id);
  if (!issue) return Response.json({ error: "Not found" }, { status: 404 });
  const recent = await db
    .select({ id: comments.id, body: comments.body, createdAt: comments.createdAt, author: users.name })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.authorId))
    .where(and(eq(comments.workspaceId, ws.id), eq(comments.issueId, id)))
    .orderBy(desc(comments.createdAt))
    .limit(3);
  return Response.json(
    {
      data: {
        description: docToText(issue.description).trim(),
        comments: recent.map((c) => ({ id: c.id, body: c.body, author: c.author ?? "Someone", createdAt: c.createdAt.toISOString() })),
        subTasks: issue.subIssues?.length ?? 0,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
