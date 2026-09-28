import "server-only";

import { and, eq, ilike, isNull, notInArray, or, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { issues, pages, projects } from "@/db/schema";
import { askKeywords } from "@/lib/ask-keywords";
import { docToText } from "@/lib/markdown";

import { assembleAskContext, type AskContext } from "./ask-rules";
import type { ApiScope } from "./scope-rules";

/**
 * Keyword retrieval for Ask over the API — the same search as the web's
 * `askContext`, but for an API caller rather than a browser session, and
 * scoped to what that caller may see.
 *
 * Hidden projects are excluded in SQL, so the eight-row limit is spent on
 * rows the caller can read, and again in `assembleAskContext`, so a hidden
 * row can never reach the model even if the query changes.
 */
export async function askContextForApi(workspaceId: string, question: string, scope: ApiScope): Promise<AskContext> {
  const kws = askKeywords(question);
  if (kws.length === 0) return { sources: [], blocks: [], note: "Try a more specific question." };

  const hidden = scope.restricted ? [...scope.hiddenProjectIds] : [];
  const visible = (col: typeof pages.projectId | typeof issues.projectId): SQL | undefined =>
    hidden.length ? or(isNull(col), notInArray(col, hidden)) : undefined;

  const pageOr = or(...kws.flatMap((k) => [ilike(pages.title, `%${k}%`), ilike(pages.contentText, `%${k}%`)]));
  const issueOr = or(...kws.map((k) => ilike(issues.title, `%${k}%`)));

  const [pageRows, issueRows] = await Promise.all([
    db
      .select({ id: pages.id, title: pages.title, contentText: pages.contentText, projectId: pages.projectId })
      .from(pages)
      .where(and(eq(pages.workspaceId, workspaceId), isNull(pages.deletedAt), visible(pages.projectId), pageOr))
      .limit(8),
    db
      .select({
        id: issues.id,
        title: issues.title,
        description: issues.description,
        number: issues.number,
        projectKey: projects.key,
        projectId: issues.projectId,
      })
      .from(issues)
      .leftJoin(projects, eq(issues.projectId, projects.id))
      .where(and(eq(issues.workspaceId, workspaceId), visible(issues.projectId), issueOr))
      .limit(8),
  ]);

  return assembleAskContext(
    pageRows,
    issueRows.map((r) => ({ id: r.id, title: r.title, text: docToText(r.description), number: r.number, projectKey: r.projectKey, projectId: r.projectId })),
    scope,
  );
}
