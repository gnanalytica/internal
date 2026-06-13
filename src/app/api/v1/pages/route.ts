import { pageDto } from "@/lib/api/dto";
import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreatePage } from "@/lib/api/ops";
import { encodeCursor, pageParams } from "@/lib/api/pagination";
import { getPagesPage } from "@/lib/data";

export const GET = withApiAuth(async (req, auth) => {
  const { limit, cursor } = pageParams(req.url);
  const { items, nextCursor } = await getPagesPage(auth.workspaceId, { limit, cursor });
  return ok({
    data: items.map(pageDto),
    next_cursor: nextCursor ? encodeCursor(nextCursor) : null,
  });
});

export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<{ title?: string; content?: string }>(req);
  const id = await apiCreatePage(auth.workspaceId, auth.userId, {
    title: body.title ?? "Untitled",
    content: body.content,
  });
  return ok({ data: { id, title: body.title ?? "Untitled" } }, 201);
});
