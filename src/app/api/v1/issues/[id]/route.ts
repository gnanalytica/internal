import { issueDetailDto, issueDto } from "@/lib/api/dto";
import { notFound, ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiDeleteIssue, apiUpdateIssue } from "@/lib/api/ops";
import { apiListIssueRelations } from "@/lib/api/collab-ops";
import { apiIssueCommentsWithReactions, apiIssueExtras } from "@/lib/api/issue-extras";
import { getIssue } from "@/lib/data";
import { db } from "@/db";
import { issues, projects } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { canSeeProject } from "@/lib/api/scope-rules";
import { assertIssueVisible, assertProjectVisible } from "@/lib/api/scope";

type Params = { id: string };

export const GET = withApiAuth<Params>(async (_req, auth, { id }) => {
  await assertIssueVisible(auth, id);
  const issue = await getIssue(auth.workspaceId, id);
  if (!issue) return notFound("Issue");
  const [comments, rawRelations, extras] = await Promise.all([
    apiIssueCommentsWithReactions(auth, id),
    apiListIssueRelations(auth.workspaceId, id),
    apiIssueExtras(auth, id),
  ]);
  // Name the other end of each relation, and drop edges into issues the
  // caller may not see rather than leak their titles.
  const others = rawRelations.length
    ? await db
        .select({ id: issues.id, number: issues.number, title: issues.title, status: issues.status, projectId: issues.projectId, key: projects.key })
        .from(issues)
        .leftJoin(projects, eq(issues.projectId, projects.id))
        .where(and(eq(issues.workspaceId, auth.workspaceId), inArray(issues.id, rawRelations.map((r) => r.issueId))))
    : [];
  const relations = rawRelations.flatMap((r) => {
    const o = others.find((x) => x.id === r.issueId);
    if (!o || !canSeeProject(auth.scope, o.projectId)) return [];
    return [{ ...r, issue: { id: o.id, identifier: o.key ? `${o.key}-${o.number}` : `#${o.number}`, title: o.title, status: o.status } }];
  });
  return ok({ data: { ...issueDetailDto(issue), ...extras, comments, relations } });
});

export const PATCH = withApiAuth<Params>(async (req, auth, { id }) => {
  await assertIssueVisible(auth, id);
  const body = await readJson(req);
  assertProjectVisible(auth, (body as { projectId?: string | null }).projectId, "Project");
  const updated = await apiUpdateIssue(auth.workspaceId, id, body);
  if (!updated) return notFound("Issue");
  const issue = await getIssue(auth.workspaceId, id);
  return ok({ data: issue ? issueDto(issue) : { id } });
});

export const DELETE = withApiAuth<Params>(async (_req, auth, { id }) => {
  await assertIssueVisible(auth, id);
  const deleted = await apiDeleteIssue(auth.workspaceId, id);
  return deleted ? ok({ deleted: true }) : notFound("Issue");
});
