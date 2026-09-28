/**
 * The pure half of `POST /api/v1/ask`: turning retrieved docs and issues into
 * the sources the client shows and the context the model reads — and making
 * sure nothing from a project the caller may not see gets into either.
 */
import { canSeeProject, type ApiScope } from "./scope-rules";

export type AskApiSource = { kind: "issue" | "page"; id: string; title: string; href: string };

export type AskPageRow = { id: string; title: string | null; contentText: string | null; projectId: string | null };
export type AskIssueRow = { id: string; title: string; text: string; number: number; projectKey: string | null; projectId: string | null };

export type AskContext = { sources: AskApiSource[]; blocks: string[]; note?: string };

export const NOTHING_FOUND = "I couldn't find anything relevant in this workspace.";

export function assembleAskContext(pageRows: AskPageRow[], issueRows: AskIssueRow[], scope: ApiScope): AskContext {
  const sources: AskApiSource[] = [];
  const blocks: string[] = [];
  for (const p of pageRows) {
    if (!canSeeProject(scope, p.projectId)) continue;
    const title = p.title || "Untitled";
    sources.push({ kind: "page", id: p.id, title, href: `/pages/${p.id}` });
    blocks.push(`[Doc: ${title}]\n${(p.contentText || "").slice(0, 1500)}`);
  }
  for (const r of issueRows) {
    if (!canSeeProject(scope, r.projectId)) continue;
    const ident = r.projectKey ? `${r.projectKey}-${r.number}` : `#${r.number}`;
    sources.push({ kind: "issue", id: r.id, title: `${ident} ${r.title}`, href: `/issues/${r.id}` });
    blocks.push(`[Issue ${ident}: ${r.title}]\n${r.text.slice(0, 800)}`);
  }
  if (blocks.length === 0) return { sources: [], blocks: [], note: NOTHING_FOUND };
  return { sources, blocks };
}
