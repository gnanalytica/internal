import { kindOr404, recordId } from "@/lib/api/prospects";
import { ApiInputError } from "@/lib/api/errors";
import { getWorkspace } from "@/lib/data";
import { readProspectView } from "@/lib/prospects/service";

/**
 * One prospect for the web's record page: the full record, its Activity and
 * its related rows, in one request.
 *
 * A GET rather than server actions because the browser runs server actions
 * one at a time: the record, its related rows and any save in flight used to
 * queue behind each other, and one slow call held up the rest until a reload.
 * A plain request runs alongside them and can be cancelled when the person
 * moves on. Session-authenticated by `proxy.ts`; `getWorkspace()` checks
 * membership, as the server actions do. The mobile app uses `/api/v1/prospects`.
 */
// A plain params type: `RouteContext` is generated into `.next/` by a build, which CI's typecheck runs without.
export async function GET(_req: Request, ctx: { params: Promise<{ kind: string; id: string }> }) {
  await getWorkspace();
  const { kind, id } = await ctx.params;
  let k;
  try {
    k = kindOr404(kind);
  } catch (err) {
    if (err instanceof ApiInputError) return Response.json({ error: err.message }, { status: err.status });
    throw err;
  }
  try {
    const view = await readProspectView(k, recordId(id));
    if (!view) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ data: view }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[prospects] record read failed", err);
    return Response.json({ error: err instanceof Error ? err.message.slice(0, 300) : "Couldn't read the sheet." }, { status: 502 });
  }
}
