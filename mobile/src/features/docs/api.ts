import { queryOptions } from "@tanstack/react-query";

import { api, ApiError, type ItemResponse, type ListResponse } from "@/lib/api";
import { queryClient } from "@/lib/query";

export type Ref = { id: string; name: string };

/** A page as the list endpoint returns it. */
export type PageSummary = { id: string; title: string; icon: string; projectId: string | null; parentId: string | null; updatedAt: string | null };

export type LinkedIssue = { id: string; identifier: string; title: string; status: string; priority: string; assignee: Ref | null; project: { id: string; key: string; name: string } | null };

export type PageDetail = {
  id: string;
  title: string;
  icon: string;
  parentId: string | null;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  creator: Ref | null;
  markdown: string;
  /** False when the body has formatting Markdown can't hold — the phone must not write over it. */
  markdownEditable: boolean;
  linkedIssues: LinkedIssue[];
  subPages: { id: string; title: string; icon: string; updatedAt: string }[];
  favorite: boolean;
  watching: boolean;
  url: string;
};

export type Reaction = { emoji: string; count: number; mine: boolean };
export type PageComment = { id: string; body: string; parentId: string | null; blockId: string | null; resolved: boolean; author: Ref | null; createdAt: string; reactions: Reaction[] };
export type Thread = PageComment & { replies: PageComment[] };

export type PageVersion = { id: string; title: string; cause: string; createdAt: string; author: Ref | null };
export type PageVersionContent = PageVersion & { markdown: string; complete: boolean };

export type TrashedPage = { id: string; title: string; icon: string; projectId: string | null; deletedAt: string };

export const REACTIONS = ["👍", "❤️", "🎉", "😄", "🚀", "👀", "✅"] as const;

/** Every page in the workspace. The list endpoint pages with a cursor, so walk it to the end. */
export const pagesQuery = queryOptions({
  queryKey: ["pages"],
  queryFn: async () => {
    const all: PageSummary[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 50; i++) {
      const res: ListResponse<PageSummary> = await api.get<ListResponse<PageSummary>>("/pages", { limit: 200, cursor: cursor ?? undefined });
      all.push(...res.data);
      cursor = res.next_cursor ?? null;
      if (!cursor) break;
    }
    return all;
  },
});

export const pageQuery = (id: string) =>
  queryOptions({
    queryKey: ["page", id],
    queryFn: async () => (await api.get<ItemResponse<PageDetail>>(`/pages/${id}`)).data,
  });

export const pageCommentsQuery = (id: string) =>
  queryOptions({
    queryKey: ["page", id, "comments"],
    queryFn: async () => (await api.get<ListResponse<PageComment>>(`/pages/${id}/comments`)).data,
  });

export const pageVersionsQuery = (id: string) =>
  queryOptions({
    queryKey: ["page", id, "versions"],
    queryFn: async () => (await api.get<ListResponse<PageVersion>>(`/pages/${id}/versions`)).data,
  });

export const pageVersionQuery = (pageId: string, versionId: string) =>
  queryOptions({
    queryKey: ["page", pageId, "versions", versionId],
    queryFn: async () => (await api.get<ItemResponse<PageVersionContent>>(`/pages/${pageId}/versions/${versionId}`)).data,
    staleTime: Infinity,
  });

export const trashQuery = queryOptions({
  queryKey: ["trash"],
  queryFn: async () => (await api.get<ListResponse<TrashedPage>>("/trash")).data,
});

/** Roots newest-first, replies oldest-first under them — the web's order. */
export function toThreads(comments: PageComment[]): Thread[] {
  const roots = new Map<string, Thread>();
  for (const c of comments) if (!c.parentId) roots.set(c.id, { ...c, replies: [] });
  for (const c of comments) {
    if (!c.parentId) continue;
    const root = roots.get(c.parentId);
    if (root) root.replies.push(c);
    else roots.set(c.id, { ...c, replies: [] });
  }
  return [...roots.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function refreshPages(id?: string): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["pages"] }),
    queryClient.invalidateQueries({ queryKey: ["trash"] }),
    id ? queryClient.invalidateQueries({ queryKey: ["page", id] }) : null,
  ]);
}

export async function createPage(input: { title?: string; parentId?: string | null; projectId?: string | null }): Promise<string> {
  const res = await api.post<ItemResponse<{ id: string }>>("/pages", { title: input.title ?? "Untitled", parentId: input.parentId ?? undefined, projectId: input.projectId ?? undefined });
  await refreshPages(input.parentId ?? undefined);
  return res.data.id;
}

/** Thrown when the page was saved elsewhere after the copy being edited. */
export class PageConflict extends Error {}

export async function savePage(id: string, patch: { title?: string; icon?: string; content?: string; knownUpdatedAt?: string }): Promise<void> {
  if (patch.title !== undefined || patch.icon !== undefined)
    queryClient.setQueryData<PageDetail>(["page", id], (old) => (old ? { ...old, ...(patch.title !== undefined ? { title: patch.title } : {}), ...(patch.icon !== undefined ? { icon: patch.icon } : {}) } : old));
  try {
    const res = await api.patch<ItemResponse<PageDetail>>(`/pages/${id}`, patch);
    if (res.data && "markdown" in res.data) queryClient.setQueryData(["page", id], res.data);
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) throw new PageConflict(e.message);
    throw e;
  } finally {
    await refreshPages(id);
  }
}

export async function trashPage(id: string): Promise<void> {
  await api.del(`/pages/${id}`);
  await refreshPages(id);
}

export async function restoreTrashed(id: string): Promise<void> {
  await api.post(`/trash/${id}`);
  await refreshPages(id);
}

export async function purgeTrashed(id: string): Promise<void> {
  await api.del(`/trash/${id}`);
  queryClient.setQueryData<TrashedPage[]>(["trash"], (old) => old?.filter((p) => p.id !== id));
  await refreshPages();
}

export async function restoreVersion(pageId: string, versionId: string): Promise<void> {
  await api.post(`/pages/${pageId}/versions`, { versionId });
  await refreshPages(pageId);
}

const refreshComments = (pageId: string) => queryClient.invalidateQueries({ queryKey: ["page", pageId, "comments"] });

export async function addPageComment(pageId: string, body: string, parentId?: string | null): Promise<void> {
  await api.post(`/pages/${pageId}/comments`, { body, parentId: parentId ?? undefined });
  await refreshComments(pageId);
}

export async function deletePageComment(pageId: string, commentId: string): Promise<void> {
  await api.del(`/page-comments/${commentId}`);
  await refreshComments(pageId);
}

export async function setCommentResolved(pageId: string, commentId: string, resolved: boolean): Promise<void> {
  queryClient.setQueryData<PageComment[]>(["page", pageId, "comments"], (old) => old?.map((c) => (c.id === commentId ? { ...c, resolved } : c)));
  try {
    await api.patch(`/page-comments/${commentId}`, { resolved });
  } finally {
    await refreshComments(pageId);
  }
}

export async function toggleCommentReaction(pageId: string, commentId: string, emoji: string): Promise<void> {
  queryClient.setQueryData<PageComment[]>(["page", pageId, "comments"], (old) =>
    old?.map((c) => {
      if (c.id !== commentId) return c;
      const existing = c.reactions.find((r) => r.emoji === emoji);
      const reactions = existing
        ? c.reactions.map((r) => (r.emoji === emoji ? { ...r, mine: !r.mine, count: r.count + (r.mine ? -1 : 1) } : r)).filter((r) => r.count > 0)
        : [...c.reactions, { emoji, count: 1, mine: true }];
      return { ...c, reactions };
    }),
  );
  try {
    await api.post(`/page-comments/${commentId}/reactions`, { emoji });
  } finally {
    await refreshComments(pageId);
  }
}
