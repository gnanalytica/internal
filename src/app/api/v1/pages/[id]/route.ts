import { notFound, ok, withApiAuth } from "@/lib/api/http";
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
