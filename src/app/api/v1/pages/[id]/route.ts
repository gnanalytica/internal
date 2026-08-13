import { apiDeletePage, apiUpdatePage } from "@/lib/api/ops";
import { notFound, ok, readJson, withApiAuth } from "@/lib/api/http";
import { getPage } from "@/lib/data";
import { docToMarkdown } from "@/lib/markdown";

type Params = { id: string };

export const GET = withApiAuth<Params>(async (_req, auth, { id }) => {
  const page = await getPage(auth.workspaceId, id);
  if (!page) return notFound("Page");
  return ok({
    data: {
      id: page.id,
      title: page.title,
      icon: page.icon,
      content: page.content,
      markdown: docToMarkdown(page.content),
    },
  });
});

export const PATCH = withApiAuth<Params>(async (req, auth, { id }) => {
  const patch = await readJson<{ title?: string; icon?: string; content?: string }>(req);
  const updated = await apiUpdatePage(auth.workspaceId, id, patch, auth.userId);
  if (!updated) return notFound("Page");
  const page = await getPage(auth.workspaceId, id);
  return ok({
    data: page
      ? {
          id: page.id,
          title: page.title,
          icon: page.icon,
          markdown: docToMarkdown(page.content),
        }
      : { id },
  });
});

export const DELETE = withApiAuth<Params>(async (_req, auth, { id }) => {
  const deleted = await apiDeletePage(auth.workspaceId, id);
  if (!deleted) return notFound("Page");
  // Soft delete — the page and its children are recoverable from /trash.
  return ok({ data: { id }, deleted: true, recoverable: true });
});
