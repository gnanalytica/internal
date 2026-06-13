import { pageDto } from "@/lib/api/dto";
import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiCreatePage } from "@/lib/api/ops";
import { getPagesFlat } from "@/lib/data";

export const GET = withApiAuth(async (_req, auth) => {
  const rows = await getPagesFlat(auth.workspaceId);
  return ok({ data: rows.map(pageDto), count: rows.length });
});

export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<{ title?: string; content?: string }>(req);
  const id = await apiCreatePage(auth.workspaceId, auth.userId, {
    title: body.title ?? "Untitled",
    content: body.content,
  });
  return ok({ data: { id, title: body.title ?? "Untitled" } }, 201);
});
